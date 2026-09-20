import {redactArtifactValue} from './artifacts/redaction.js';
import type {ContentItem} from './config/schema.js';
import type {RunArtifact} from './artifacts/runs.js';

export interface ComposioTool {
  slug: string;
  name?: string;
  description?: string;
  human_description?: string;
  tags?: string[];
  input_parameters?: Record<string, unknown>;
  toolkit?: {slug?: string; name?: string; logo?: string};
  auth_config_id?: string;
  authConfigId?: string;
}

export interface ComposioToolkit {
  slug: string;
  name?: string;
  description?: string;
  meta?: {description?: string; categories?: Array<{id?: string; name?: string}>};
  auth_configs?: Array<{id?: string}>;
  auth_config_id?: string;
}

interface ComposioAuthConfig {
  id?: string;
  status?: string;
  is_composio_managed?: boolean;
}

export interface ComposioCapability {
  actionSlug: string;
  actionName: string;
  description: string;
  toolkitSlug: string;
  toolkitName: string;
  inputParameters: Record<string, unknown>;
  authConfigId: string | null;
}

export interface ComposioConnection {
  id: string;
  toolkitSlug: string;
  alias: string | null;
  status: string;
  userId: string | null;
  displayName: string | null;
}

export interface ComposioFetch {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

export class ComposioError extends Error {
  constructor(public readonly status: number, public readonly endpoint: string, public readonly responseBody: unknown) {
    super(`Composio request failed (${status}) at ${endpoint}.`);
    this.name = 'ComposioError';
  }
}

export class ComposioClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: ComposioFetch;

  constructor(private readonly options: {apiKey: string; userId: string; baseUrl?: string; fetchImpl?: ComposioFetch}) {
    this.baseUrl = (options.baseUrl ?? 'https://backend.composio.dev/api/v3.1').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listPublishingCapabilities(): Promise<ComposioCapability[]> {
    const tools: ComposioTool[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({toolkit_versions: 'latest', limit: '1000'});
      if (cursor) query.set('cursor', cursor);
      const page = await this.request<{items?: ComposioTool[]; next_cursor?: string}>(`/tools?${query}`);
      tools.push(...(page.items ?? []));
      cursor = page.next_cursor;
    } while (cursor);
    const candidates = tools.filter(isPotentialPublishAction);
    const slugs = [...new Set(candidates.map((tool) => tool.toolkit?.slug).filter((slug): slug is string => Boolean(slug)))];
    const toolkits = new Map<string, ComposioToolkit>();
    const authConfigs = new Map<string, ComposioAuthConfig>();
    await Promise.all(slugs.map(async (slug) => {
      const [toolkitResult, authConfigResult] = await Promise.allSettled([
        this.request<ComposioToolkit>(`/toolkits/${encodeURIComponent(slug)}`),
        this.request<{items?: ComposioAuthConfig[]}>(`/auth_configs?toolkit_slug=${encodeURIComponent(slug)}&is_composio_managed=true&limit=50`),
      ]);
      if (toolkitResult.status === 'fulfilled') toolkits.set(slug, toolkitResult.value);
      if (authConfigResult.status === 'fulfilled') {
        const config = (authConfigResult.value.items ?? []).find((item) => item.status !== 'DISABLED' && item.id);
        if (config) authConfigs.set(slug, config);
      }
    }));
    return candidates.filter((tool) => {
      const slug = tool.toolkit?.slug;
      return slug ? isContentToolkit(toolkits.get(slug), tool) : false;
    }).map((tool) => {
      const toolkitSlug = tool.toolkit?.slug ?? 'unknown';
      const toolkit = toolkits.get(toolkitSlug);
      return {
        actionSlug: tool.slug,
        actionName: tool.name ?? tool.slug,
        description: tool.human_description ?? tool.description ?? '',
        toolkitSlug,
        toolkitName: toolkit?.name ?? tool.toolkit?.name ?? toolkitSlug,
        inputParameters: tool.input_parameters ?? {},
        authConfigId: tool.auth_config_id ?? tool.authConfigId ?? toolkit?.auth_config_id ?? toolkit?.auth_configs?.[0]?.id ?? authConfigs.get(toolkitSlug)?.id ?? null,
      } satisfies ComposioCapability;
    });
  }

  async listConnections(): Promise<ComposioConnection[]> {
    const query = new URLSearchParams({user_ids: this.options.userId, limit: '1000'});
    const response = await this.request<{items?: Array<Record<string, unknown>>}>(`/connected_accounts?${query}`);
    return (response.items ?? []).map((connection) => ({
      id: String(connection.id),
      toolkitSlug: String((connection.toolkit as Record<string, unknown> | undefined)?.slug ?? connection.toolkit_slug ?? ''),
      alias: typeof connection.alias === 'string' ? connection.alias : null,
      status: String(connection.status ?? 'UNKNOWN'),
      userId: typeof connection.user_id === 'string' ? connection.user_id : null,
      displayName: typeof (connection.data as Record<string, unknown> | undefined)?.displayName === 'string' ? String((connection.data as Record<string, unknown>).displayName) : null,
    }));
  }

  async createConnectLink(input: {authConfigId: string; alias?: string}): Promise<{redirectUrl: string; connectedAccountId: string | null}> {
    const response = await this.request<{redirect_url?: string; connected_account_id?: string}>('/connected_accounts/link', {
      method: 'POST',
      body: JSON.stringify({auth_config_id: input.authConfigId, user_id: this.options.userId, ...(input.alias ? {alias: input.alias} : {})}),
    });
    if (!response.redirect_url) throw new Error('Composio did not return a connect link.');
    return {redirectUrl: response.redirect_url, connectedAccountId: response.connected_account_id ?? null};
  }

  async execute(actionSlug: string, connectedAccountId: string, arguments_: Record<string, unknown>): Promise<unknown> {
    return this.request(`/tools/execute/${encodeURIComponent(actionSlug)}`, {
      method: 'POST',
      body: JSON.stringify({connected_account_id: connectedAccountId, arguments: arguments_, version: 'latest'}),
    });
  }

  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
      ...init,
      headers: {'accept': 'application/json', 'content-type': 'application/json', 'x-api-key': this.options.apiKey, ...(init.headers ?? {})},
    });
    const value = (await response.json().catch(() => ({}))) as T;
    if (!response.ok) throw new ComposioError(response.status, endpoint, value);
    return value;
  }
}

export const isPotentialPublishAction = (tool: ComposioTool): boolean => {
  const text = `${tool.slug} ${tool.name ?? ''} ${tool.description ?? ''} ${tool.human_description ?? ''} ${(tool.tags ?? []).join(' ')}`.toLowerCase();
  return /(publish|posting|post|upload|send|create)/.test(text) && !/(read|list|fetch|search|find|delete|remove|comment|like|follow|analytics|insight|metric)/.test(tool.slug.toLowerCase());
};

export const isContentToolkit = (toolkit: ComposioToolkit | undefined, tool: ComposioTool): boolean => {
  const text = [toolkit?.slug, toolkit?.name, toolkit?.description, toolkit?.meta?.description, ...(toolkit?.meta?.categories ?? []).flatMap((category) => [category.id, category.name]), ...(tool.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
  return /(social|content|media|marketing|creator|publishing|instagram|threads|facebook|tiktok|youtube|linkedin|pinterest|twitter|bluesky)/.test(text);
};

export function buildComposioArguments(capability: ComposioCapability, item: ContentItem): {arguments: Record<string, unknown>; missing: string[]} {
  const parameters = readParameters(capability.inputParameters);
  const required = new Set(readRequired(capability.inputParameters));
  const args: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const [name, schema] of Object.entries(parameters)) {
    const value = valueForParameter(name, item);
    if (value !== undefined) args[name] = value;
    const requiredBySchema = typeof schema === 'object' && schema !== null && 'required' in schema && schema.required === true;
    if (value === undefined && (required.has(name) || requiredBySchema)) missing.push(name);
  }
  return {arguments: args, missing};
}

export async function publishThroughComposio(input: {client: ComposioClient; capability: ComposioCapability; connectionId: string; item: ContentItem; createdAt?: string}): Promise<RunArtifact> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!['ready', 'dry_run_ok'].includes(input.item.status)) return {itemId: input.item.id, type: 'publish', status: 'blocked', createdAt, message: `publish_blocked: item status ${input.item.status} is not ready or dry_run_ok`};
  const built = buildComposioArguments(input.capability, input.item);
  if (built.missing.length) return {itemId: input.item.id, type: 'publish', status: 'blocked', createdAt, message: `publish_blocked: Composio action requires unsupported fields: ${built.missing.join(', ')}`, payload: built.arguments};
  try {
    const response = await input.client.execute(input.capability.actionSlug, input.connectionId, built.arguments);
    return {itemId: input.item.id, type: 'publish', status: 'ok', createdAt, message: `Published through Composio action ${input.capability.actionSlug}.`, payload: built.arguments, response: redactArtifactValue(response)};
  } catch (error) {
    return {itemId: input.item.id, type: 'publish', status: 'failed', createdAt, message: error instanceof Error ? error.message : String(error), payload: built.arguments};
  }
}

function readParameters(input: Record<string, unknown>): Record<string, unknown> {
  const properties = input.properties;
  return properties && typeof properties === 'object' && !Array.isArray(properties) ? properties as Record<string, unknown> : input;
}

function readRequired(input: Record<string, unknown>): string[] {
  return Array.isArray(input.required) ? input.required.filter((item): item is string => typeof item === 'string') : [];
}

function valueForParameter(name: string, item: ContentItem): unknown {
  const key = name.toLowerCase();
  if (/(^|_)(title|name)(_|$)/.test(key)) return item.title;
  if (/(caption|text|content|message|body|description|copy)/.test(key)) return item.body;
  if (/(media|asset|image|video|file|url)/.test(key)) {
    const urls = item.assets.map((asset) => asset.publicUrl).filter((url): url is string => Boolean(url));
    if (!urls.length) return undefined;
    return key.includes('urls') || key.includes('media') && !key.includes('url') ? urls : urls[0];
  }
  if (key.includes('scheduled') || key.includes('publish_at')) return item.scheduledAt;
  return undefined;
}
