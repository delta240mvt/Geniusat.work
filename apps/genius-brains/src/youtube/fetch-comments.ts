import type { YouTubeClient } from "./client.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 1;
const MAX_PAGES = 10;

export type YouTubeCommentOrder = "time" | "relevance";
export type YouTubeCommentTextFormat = "html" | "plainText";

export interface FetchYouTubeCommentsInput {
  videoId: string;
  pageToken?: string;
  pageSize?: number;
  maxPages?: number;
  order?: YouTubeCommentOrder;
  textFormat?: YouTubeCommentTextFormat;
  includeReplies?: boolean;
  signal?: AbortSignal;
}

export interface YouTubeCommentAuthor {
  channelId?: string;
  channelUrl?: string;
  displayName: string;
  profileImageUrl?: string;
}

export interface YouTubeComment {
  id: string;
  textDisplay: string;
  textOriginal: string;
  publishedAt: string;
  updatedAt: string;
  likeCount: number;
  author: YouTubeCommentAuthor;
}

export interface YouTubeCommentThread {
  id: string;
  videoId: string;
  canReply: boolean;
  isPublic: boolean;
  totalReplyCount: number;
  topLevelComment: YouTubeComment;
  replies: YouTubeComment[];
}

export interface FetchYouTubeCommentsResult {
  videoId: string;
  order: YouTubeCommentOrder;
  textFormat: YouTubeCommentTextFormat;
  includeReplies: boolean;
  requestedPageSize: number;
  pagesFetched: number;
  nextPageToken?: string;
  exhausted: boolean;
  threads: YouTubeCommentThread[];
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface FetchBestYouTubeCommentsResult {
  videoId: string;
  threads: YouTubeCommentThread[];
  fetches: {
    relevance: {
      commentsFetched: number;
      exhausted: boolean;
      pagesFetched: number;
    };
    time: {
      commentsFetched: number;
      exhausted: boolean;
      pagesFetched: number;
    };
  };
}

interface YouTubeCommentThreadsResponse {
  nextPageToken?: string;
  pageInfo?: {
    totalResults?: number;
    resultsPerPage?: number;
  };
  items?: YouTubeCommentThreadItem[];
}

interface YouTubeCommentThreadItem {
  id?: string;
  snippet?: {
    videoId?: string;
    canReply?: boolean;
    isPublic?: boolean;
    totalReplyCount?: number;
    topLevelComment?: {
      id?: string;
      snippet?: YouTubeCommentSnippet;
    };
  };
  replies?: {
    comments?: Array<{
      id?: string;
      snippet?: YouTubeCommentSnippet;
    }>;
  };
}

interface YouTubeCommentSnippet {
  textDisplay?: string;
  textOriginal?: string;
  authorDisplayName?: string;
  authorProfileImageUrl?: string;
  authorChannelUrl?: string;
  authorChannelId?: {
    value?: string;
  };
  publishedAt?: string;
  updatedAt?: string;
  likeCount?: number;
}

export async function fetchYouTubeCommentThreads(
  client: YouTubeClient,
  input: FetchYouTubeCommentsInput,
): Promise<FetchYouTubeCommentsResult> {
  const videoId = input.videoId.trim();

  if (!videoId) {
    throw new Error("videoId is required.");
  }

  const order = input.order ?? "time";
  const textFormat = input.textFormat ?? "plainText";
  const includeReplies = input.includeReplies ?? false;
  const requestedPageSize = clampInteger(input.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const maxPages = clampInteger(input.maxPages, DEFAULT_MAX_PAGES, 1, MAX_PAGES);
  const threads: YouTubeCommentThread[] = [];

  let pagesFetched = 0;
  let nextPageToken = normalizeToken(input.pageToken);
  let pageInfo: FetchYouTubeCommentsResult["pageInfo"];

  while (pagesFetched < maxPages) {
    const response = await client.get<YouTubeCommentThreadsResponse>("/commentThreads", {
      params: {
        part: includeReplies ? "snippet,replies" : "snippet",
        videoId,
        maxResults: requestedPageSize,
        order,
        textFormat,
        pageToken: nextPageToken,
      },
      signal: input.signal,
    });

    pagesFetched += 1;
    nextPageToken = normalizeToken(response.nextPageToken);
    pageInfo = toPageInfo(response.pageInfo);

    for (const item of response.items ?? []) {
      const thread = toThread(item, includeReplies);

      if (thread) {
        threads.push(thread);
      }
    }

    if (!nextPageToken) {
      break;
    }
  }

  return {
    videoId,
    order,
    textFormat,
    includeReplies,
    requestedPageSize,
    pagesFetched,
    nextPageToken,
    exhausted: nextPageToken === undefined,
    threads,
    pageInfo,
  };
}

export async function fetchBestYouTubeCommentThreads(
  client: YouTubeClient,
  input: FetchYouTubeCommentsInput,
): Promise<FetchBestYouTubeCommentsResult> {
  const [relevance, time] = await Promise.all([
    fetchYouTubeCommentThreads(client, {
      ...input,
      order: "relevance",
    }),
    fetchYouTubeCommentThreads(client, {
      ...input,
      order: "time",
    }),
  ]);

  const merged = new Map<string, YouTubeCommentThread>();

  for (const thread of [...relevance.threads, ...time.threads]) {
    const existing = merged.get(thread.topLevelComment.id);

    if (!existing || compareThreads(thread, existing) < 0) {
      merged.set(thread.topLevelComment.id, thread);
    }
  }

  return {
    videoId: input.videoId,
    threads: [...merged.values()].sort(compareThreads),
    fetches: {
      relevance: {
        commentsFetched: relevance.threads.length,
        exhausted: relevance.exhausted,
        pagesFetched: relevance.pagesFetched,
      },
      time: {
        commentsFetched: time.threads.length,
        exhausted: time.exhausted,
        pagesFetched: time.pagesFetched,
      },
    },
  };
}

function toThread(item: YouTubeCommentThreadItem, includeReplies: boolean): YouTubeCommentThread | undefined {
  const snippet = item.snippet;
  const topLevelComment = item.snippet?.topLevelComment;
  const topLevelCommentSnippet = topLevelComment?.snippet;

  if (!item.id || !snippet?.videoId || !topLevelComment?.id || !topLevelCommentSnippet) {
    return undefined;
  }

  return {
    id: item.id,
    videoId: snippet.videoId,
    canReply: snippet.canReply ?? false,
    isPublic: snippet.isPublic ?? true,
    totalReplyCount: snippet.totalReplyCount ?? 0,
    topLevelComment: toComment(topLevelComment.id, topLevelCommentSnippet),
    replies: includeReplies
      ? (item.replies?.comments ?? [])
          .map((reply) => {
            if (!reply.id || !reply.snippet) {
              return undefined;
            }

            return toComment(reply.id, reply.snippet);
          })
          .filter((reply): reply is YouTubeComment => reply !== undefined)
      : [],
  };
}

function toComment(id: string, snippet: YouTubeCommentSnippet): YouTubeComment {
  return {
    id,
    textDisplay: snippet.textDisplay ?? "",
    textOriginal: snippet.textOriginal ?? "",
    publishedAt: snippet.publishedAt ?? "",
    updatedAt: snippet.updatedAt ?? "",
    likeCount: snippet.likeCount ?? 0,
    author: {
      channelId: snippet.authorChannelId?.value,
      channelUrl: snippet.authorChannelUrl,
      displayName: snippet.authorDisplayName ?? "",
      profileImageUrl: snippet.authorProfileImageUrl,
    },
  };
}

function toPageInfo(
  pageInfo: YouTubeCommentThreadsResponse["pageInfo"],
): FetchYouTubeCommentsResult["pageInfo"] | undefined {
  if (!pageInfo) {
    return undefined;
  }

  return {
    totalResults: pageInfo.totalResults ?? 0,
    resultsPerPage: pageInfo.resultsPerPage ?? 0,
  };
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(value as number)));
}

function normalizeToken(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }

  const normalized = token.trim();
  return normalized ? normalized : undefined;
}

function compareThreads(left: YouTubeCommentThread, right: YouTubeCommentThread): number {
  return (
    scoreThread(right) - scoreThread(left) ||
    right.topLevelComment.likeCount - left.topLevelComment.likeCount ||
    Date.parse(left.topLevelComment.publishedAt || "") - Date.parse(right.topLevelComment.publishedAt || "") ||
    left.topLevelComment.id.localeCompare(right.topLevelComment.id)
  );
}

function scoreThread(thread: YouTubeCommentThread): number {
  return thread.topLevelComment.likeCount + thread.totalReplyCount * 3;
}
