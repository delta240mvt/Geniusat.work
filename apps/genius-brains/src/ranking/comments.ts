import { normalizeComment, type NormalizeCommentOptions, type NormalizedComment, type RawComment } from "../normalize/index.js";

export interface RankedComment extends NormalizedComment {
  engagementScore: number;
  whySelected: string;
}

export interface RankCommentsOptions extends NormalizeCommentOptions {
  likesWeight?: number;
  repliesWeight?: number;
}

export function rankComments(
  comments: RawComment[],
  options: RankCommentsOptions = {},
): RankedComment[] {
  return comments
    .map((comment) => buildRankedComment(comment, options))
    .sort(compareRankedComments);
}

export function selectTopComment(
  comments: RawComment[],
  options: RankCommentsOptions = {},
): RankedComment | null {
  const [topComment] = rankComments(comments, options);
  return topComment ?? null;
}

export function selectTopComments(
  comments: RawComment[],
  limit = 100,
  options: RankCommentsOptions = {},
): RankedComment[] {
  return rankComments(comments, options).slice(0, Math.max(1, limit));
}

function buildRankedComment(
  comment: RawComment,
  options: RankCommentsOptions,
): RankedComment {
  const normalized = normalizeComment(comment, options);
  const engagementScore = calculateScore(normalized, options);

  return {
    ...normalized,
    engagementScore,
    whySelected: buildWhySelected(normalized, engagementScore),
  };
}

function calculateScore(comment: NormalizedComment, options: RankCommentsOptions): number {
  const likesWeight = options.likesWeight ?? 1;
  const repliesWeight = options.repliesWeight ?? 3;
  return comment.likeCount * likesWeight + comment.replyCount * repliesWeight;
}

function buildWhySelected(comment: NormalizedComment, engagementScore: number): string {
  if (comment.replyCount >= 10) {
    return "strong reply activity";
  }

  if (engagementScore >= 100) {
    return "high likes + replies";
  }

  if (comment.likeCount >= 50) {
    return "high likes";
  }

  if (comment.replyCount >= 3) {
    return "active discussion";
  }

  return "useful signal";
}

function compareRankedComments(left: RankedComment, right: RankedComment): number {
  return (
    right.engagementScore - left.engagementScore ||
    right.likeCount - left.likeCount ||
    left.publishedAtMs - right.publishedAtMs ||
    left.id.localeCompare(right.id)
  );
}
