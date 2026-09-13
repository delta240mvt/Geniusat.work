export interface RawComment {
  id: string;
  author: string;
  text: string;
  likeCount?: number | null;
  replyCount?: number | null;
  isPinned?: boolean | null;
  publishedAt?: string | null;
}

export interface NormalizeCommentOptions {
  now?: string | Date;
}

export interface NormalizedComment {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  replyCount: number;
  isPinned: boolean;
  publishedAt: string | null;
  publishedAtMs: number;
  charCount: number;
  wordCount: number;
  ageHours: number;
}

export function normalizeComment(
  comment: RawComment,
  options: NormalizeCommentOptions = {},
): NormalizedComment {
  const text = normalizeWhitespace(comment.text);
  const publishedAtMs = normalizeTimestamp(comment.publishedAt);
  const nowMs = normalizeNow(options.now);
  const ageHours =
    publishedAtMs > 0 ? Math.max(0, Math.floor((nowMs - publishedAtMs) / 3_600_000)) : Number.MAX_SAFE_INTEGER;

  return {
    id: comment.id,
    author: comment.author,
    text,
    likeCount: normalizeCount(comment.likeCount),
    replyCount: normalizeCount(comment.replyCount),
    isPinned: Boolean(comment.isPinned),
    publishedAt: publishedAtMs > 0 ? new Date(publishedAtMs).toISOString() : null,
    publishedAtMs,
    charCount: text.length,
    wordCount: text.length === 0 ? 0 : text.split(" ").length,
    ageHours,
  };
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCount(value?: number | null): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

function normalizeTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeNow(now?: string | Date): number {
  if (!now) {
    return Date.now();
  }

  return now instanceof Date ? now.getTime() : Date.parse(now);
}
