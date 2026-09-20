import type {ViralCandidate, ViralPlatform, ViralLanguage} from './types.js';

export interface SocialCrawlEnvelope<T = unknown> {
  success?: boolean;
  data?: T;
  credits_used?: number;
  request_id?: string;
  cached?: boolean;
  pagination?: {next_cursor?: string; has_more?: boolean};
}

export interface DiscoveryContext {
  runId: string;
  platform: ViralPlatform;
  language: ViralLanguage;
  subtopic: string;
  query: string;
  rawPayloadPath: string;
}

export interface SocialCrawlClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class SocialCrawlClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SocialCrawlClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://www.socialcrawl.dev/v1';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchInstagramReels(query: string, page?: number, cursor?: string): Promise<SocialCrawlEnvelope> {
    return this.request('/instagram/search/reels', {query, ...(page ? {page: String(page)} : {}), ...(cursor ? {cursor} : {})});
  }

  async searchThreads(
    query: string,
    options: {startDate?: string; endDate?: string; limit?: number; cursor?: string} = {},
  ): Promise<SocialCrawlEnvelope> {
    return this.request('/threads/search', {
      query,
      ...(options.startDate ? {start_date: options.startDate} : {}),
      ...(options.endDate ? {end_date: options.endDate} : {}),
      ...(options.limit ? {limit: String(options.limit)} : {}),
      ...(options.cursor ? {cursor: options.cursor} : {}),
      expand: 'false',
      relevance: 'filter',
      relevance_threshold: '0.6',
    });
  }

  async getInstagramComments(url: string, cursor?: string): Promise<SocialCrawlEnvelope> {
    return this.request('/instagram/post/comments', {url, ...(cursor ? {cursor} : {})});
  }

  async getThreadsPost(url: string): Promise<SocialCrawlEnvelope> {
    return this.request('/threads/post', {url});
  }

  async getThreadsComments(url: string, limit?: number): Promise<SocialCrawlEnvelope> {
    return this.request('/threads/post/comments', {url, ...(limit ? {limit: String(limit)} : {})});
  }

  private async request(path: string, params: Record<string, string>): Promise<SocialCrawlEnvelope> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.search = new URLSearchParams(params).toString();
    const response = await this.fetchImpl(url, {
      headers: {accept: 'application/json', 'x-api-key': this.options.apiKey},
    });

    const body = (await response.json()) as SocialCrawlEnvelope;
    if (!response.ok || body.success === false) {
      throw new SocialCrawlError(response.status, path, body);
    }

    return body;
  }
}

export class SocialCrawlError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly responseBody: unknown,
  ) {
    super(`SocialCrawl request failed (${status}) at ${endpoint}.`);
    this.name = 'SocialCrawlError';
  }
}

export function normalizeSearchItems(payload: unknown, context: DiscoveryContext): ViralCandidate[] {
  const items = readItems(payload);
  return items.flatMap((item) => {
    const post = readRecord(item.post) ?? readRecord(item);
    const id = readString(post?.id);
    const url = readString(post?.url);
    if (!id || !url) return [];

    const content = readRecord(post?.content);
    const author = readRecord(post?.author);
    const engagement = readRecord(post?.engagement);
    const mediaUrls = readMediaUrls(content?.media_urls ?? post?.media_urls);
    const isInstagram = context.platform === 'instagram';
    const mediaType = (readString(content?.media_type) ?? readString(post?.media_type) ?? '').toLowerCase();
    const isThreadVideo = mediaType.includes('video') || (!mediaType && mediaUrls.some(isLikelyVideoUrl));
    const comments = readNumber(engagement?.comments);

    return [{
      candidateId: `${context.platform}:${id}`,
      runId: context.runId,
      platform: context.platform,
      language: context.language,
      subtopic: context.subtopic,
      sourceQuery: context.query,
      sourcePostId: id,
      sourceUrl: url,
      contentType: isInstagram ? 'reel' : isThreadVideo ? 'video' : 'post',
      text: readString(content?.text) ?? readString(post?.text),
      mediaUrls,
      thumbnailUrl: readString(content?.thumbnail_url) ?? readString(post?.thumbnail_url),
      publishedAt: readString(post?.published_at) ?? readString(post?.created_at),
      author: {
        username: readString(author?.username),
        displayName: readString(author?.display_name) ?? readString(author?.name),
      },
      metrics: {
        views: readNumber(engagement?.views),
        likes: readNumber(engagement?.likes),
        comments,
        replies: context.platform === 'threads' ? comments : readNumber(engagement?.replies),
        reposts: readNumber(engagement?.reposts) ?? readNumber(engagement?.reshares),
        shares: readNumber(engagement?.shares),
      },
      score: {discovery: 0, final: null, components: {}},
      evidence: {rawPayloadPath: context.rawPayloadPath, commentsPath: null},
    } satisfies ViralCandidate];
  });
}

export function normalizeComments(payload: unknown): Array<{
  platformCommentId: string;
  author: string | null;
  text: string;
  likes: number | null;
  replies: number | null;
  parentId: string | null;
  publishedAt: string | null;
}> {
  const items = readItems(payload);
  return items.flatMap((item, index) => {
    const comment = readRecord(item.comment) ?? readRecord(item);
    const id = readString(comment?.id) ?? `comment-${index + 1}`;
    const content = readRecord(comment?.content);
    const author = readRecord(comment?.author);
    const text = readString(content?.text) ?? readString(comment?.text);
    if (!text) return [];
    const engagement = readRecord(comment?.engagement);
    return [{
      platformCommentId: id,
      author: readString(author?.username) ?? readString(author?.display_name),
      text,
      likes: readNumber(engagement?.likes),
      replies: readNumber(engagement?.replies) ?? readNumber(comment?.reply_count),
      parentId: readString(comment?.parent_id),
      publishedAt: readString(comment?.published_at),
    }];
  });
}

export function normalizePostMetrics(payload: unknown): Partial<ViralCandidate['metrics']> {
  const root = readRecord(payload);
  const data = readRecord(root?.data);
  const post = readRecord(data?.post) ?? readRecord(data?.item) ?? readRecord(data) ?? readRecord(root?.post);
  const engagement = readRecord(post?.engagement);
  return {
    views: readNumber(engagement?.views),
    likes: readNumber(engagement?.likes),
    comments: readNumber(engagement?.comments),
    replies: readNumber(engagement?.replies) ?? readNumber(engagement?.comments),
    reposts: readNumber(engagement?.reposts) ?? readNumber(engagement?.reshares),
    shares: readNumber(engagement?.shares),
  };
}

function readItems(payload: unknown): Array<Record<string, unknown>> {
  const root = readRecord(payload);
  const data = readRecord(root?.data);
  const items = data?.items;
  return Array.isArray(items) ? items.filter((item): item is Record<string, unknown> => Boolean(readRecord(item))) : [];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readMediaUrls(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function isLikelyVideoUrl(value: string): boolean {
  return /\.(mp4|mov|m4v|webm)(?:$|[?#])/i.test(value);
}
