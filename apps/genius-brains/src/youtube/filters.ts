import {parseIso8601DurationToSeconds} from "../utils/time.js";

export interface ChannelVideoFiltersInput {
  limit?: number;
  includeShorts?: boolean;
  includeLive?: boolean;
}

export interface ChannelVideoFilters {
  limit: number;
  includeShorts: boolean;
  includeLive: boolean;
}

export interface FilterableVideo {
  id: string;
  title: string;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  duration: string;
  privacyStatus?: string;
  liveBroadcastContent?: string;
  hasLiveStreamingDetails?: boolean;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export function normalizeChannelVideoFilters(
  input: ChannelVideoFiltersInput = {},
): ChannelVideoFilters {
  const limit = input.limit ?? DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error("YouTube channel video limit must be between 1 and 50.");
  }

  return {
    limit,
    includeShorts: input.includeShorts ?? true,
    includeLive: input.includeLive ?? false,
  };
}

export function isPublicVideo(video: FilterableVideo): boolean {
  return (video.privacyStatus ?? "public") === "public";
}

export function isLiveLikeVideo(video: FilterableVideo): boolean {
  return (video.liveBroadcastContent ?? "none") !== "none" || Boolean(video.hasLiveStreamingDetails);
}

export function isShortLikeVideo(video: FilterableVideo): boolean {
  return parseIso8601DurationToSeconds(video.duration) <= 90;
}

export function filterChannelVideos<T extends FilterableVideo>(
  videos: T[],
  filters: ChannelVideoFilters,
): T[] {
  return videos.filter((video) => {
    if (!isPublicVideo(video)) {
      return false;
    }

    if (!filters.includeLive && isLiveLikeVideo(video)) {
      return false;
    }

    if (!filters.includeShorts && isShortLikeVideo(video)) {
      return false;
    }

    return true;
  });
}
