export interface ComposioFetch {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

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
  toolkit?: {slug?: string};
}

export interface ComposioCapability {
  actionSlug: string;
  actionName: string;
  description: string;
  toolkitSlug: string;
  toolkitName: string;
  logo?: string;
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
  updatedAt: string | null;
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
    const toolkitSlugs = [...new Set(candidates.map((tool) => tool.toolkit?.slug).filter((slug): slug is string => Boolean(slug)))];
    const toolkits = new Map<string, ComposioToolkit>();
    const authConfigs = new Map<string, ComposioAuthConfig>();
    await Promise.all(toolkitSlugs.map(async (slug) => {
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

    return candidates
      .filter((tool) => {
        const slug = tool.toolkit?.slug;
        return slug ? isContentToolkit(toolkits.get(slug), tool) : false;
      })
      .map((tool) => {
        const toolkitSlug = tool.toolkit?.slug ?? 'unknown';
        const toolkit = toolkits.get(toolkitSlug);
        return {
          actionSlug: tool.slug,
          actionName: tool.name ?? tool.slug,
          description: tool.human_description ?? tool.description ?? '',
          toolkitSlug,
          toolkitName: toolkit?.name ?? tool.toolkit?.name ?? toolkitSlug,
          logo: tool.toolkit?.logo,
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
      displayName: typeof (connection.data as Record<string, unknown> | undefined)?.displayName === 'string'
        ? String((connection.data as Record<string, unknown>).displayName)
        : null,
      updatedAt: typeof connection.updated_at === 'string' ? connection.updated_at : null,
    }));
  }

  async createConnectLink(input: {authConfigId: string; alias?: string; callbackUrl?: string}): Promise<{redirectUrl: string; connectedAccountId: string | null}> {
    const response = await this.request<{redirect_url?: string; connected_account_id?: string}>('/connected_accounts/link', {
      method: 'POST',
      body: JSON.stringify({
        auth_config_id: input.authConfigId,
        user_id: this.options.userId,
        ...(input.alias ? {alias: input.alias} : {}),
        ...(input.callbackUrl ? {callback_url: input.callbackUrl} : {}),
      }),
    });
    if (!response.redirect_url) throw new Error('Composio nie zwrócił linku logowania.');
    return {redirectUrl: response.redirect_url, connectedAccountId: response.connected_account_id ?? null};
  }

  async execute(actionSlug: string, connectedAccountId: string, arguments_: Record<string, unknown>): Promise<unknown> {
    const response = await this.request(`/tools/execute/${encodeURIComponent(actionSlug)}`, {
      method: 'POST',
      body: JSON.stringify({connected_account_id: connectedAccountId, arguments: arguments_, version: 'latest'}),
    });
    return redactComposioValue(response);
  }

  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
      ...init,
      headers: {'accept': 'application/json', 'content-type': 'application/json', 'x-api-key': this.options.apiKey, ...(init.headers ?? {})},
    });
    const body = (await response.json().catch(() => ({}))) as T;
    if (!response.ok) throw new ComposioError(response.status, endpoint, body);
    return body;
  }
}

function redactComposioValue(value: unknown, key = ''): unknown {
  if (/(token|secret|password|credential|api[_-]?key|authorization)/i.test(key)) return '<redacted>';
  if (Array.isArray(value)) return value.map((item) => redactComposioValue(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactComposioValue(entryValue, entryKey)]));
  }
  return value;
}

export function isPotentialPublishAction(tool: ComposioTool): boolean {
  const slug = tool.slug.toLowerCase();
  const publishesContent = /(?:^|[_-])(?:publish|post|upload)(?:$|[_-])/.test(slug)
    || /(?:^|[_-])create[_-](?:tweet|reel|story|thread)(?:$|[_-])/.test(slug);
  return publishesContent && !/(?:^|[_-])(?:read|list|fetch|search|find|delete|remove|comment|like|follow|message|campaign|advertisement|ads|analytics|insight|metric)(?:$|[_-])/.test(slug);
}

export function isContentToolkit(toolkit: ComposioToolkit | undefined, tool: ComposioTool): boolean {
  const text = [
    toolkit?.slug,
    toolkit?.name,
    toolkit?.description,
    toolkit?.meta?.description,
    ...(toolkit?.meta?.categories ?? []).flatMap((category) => [category.id, category.name]),
    ...(tool.tags ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  return /(social|content|media|marketing|creator|publishing|instagram|threads|facebook|tiktok|youtube|linkedin|pinterest|twitter|bluesky)/.test(text);
}
