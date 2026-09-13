import {
  filterChannelVideos,
  normalizeChannelVideoFilters,
  type ChannelVideoFilters,
  type ChannelVideoFiltersInput,
  type FilterableVideo,
} from "./filters.js";
import type {YouTubeClient} from "./client.js";
import { resolveChannel, type ChannelLookupResult, type ResolvedChannel } from "./resolve-channel.js";

export interface ListChannelVideosRequest {
  kind: "list-channel-videos";
  channel: ResolvedChannel;
  filters: ChannelVideoFilters;
}

export function listChannelVideos(
  channel: ResolvedChannel,
  filters?: ChannelVideoFiltersInput,
): ListChannelVideosRequest {
  return {
    kind: "list-channel-videos",
    channel,
    filters: normalizeChannelVideoFilters(filters),
  };
}

type SearchChannelResponse = {
  items?: Array<{
    id?: {channelId?: string};
    snippet?: {channelTitle?: string};
  }>;
};

type ChannelsResponse = {
  items?: Array<{
    id?: string;
    snippet?: {title?: string};
    contentDetails?: {relatedPlaylists?: {uploads?: string}};
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{
    contentDetails?: {videoId?: string};
  }>;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      channelId?: string;
      channelTitle?: string;
      liveBroadcastContent?: string;
    };
    status?: {privacyStatus?: string};
    statistics?: {viewCount?: string; likeCount?: string; commentCount?: string};
    contentDetails?: {duration?: string};
    liveStreamingDetails?: Record<string, unknown>;
  }>;
};

export async function resolveChannelLookup(
  client: YouTubeClient,
  channel: ResolvedChannel,
): Promise<ChannelLookupResult> {
  if (channel.bootstrapBy === "channel-id" && channel.channelId) {
    const response = await client.get<ChannelsResponse>("/channels", {
      params: {
        part: "snippet,contentDetails",
        id: channel.channelId,
      },
    });

    const item = response.items?.[0];
    if (!item?.id) {
      throw new Error(`Channel not found for id ${channel.channelId}.`);
    }

    return {
      channelId: item.id,
      title: item.snippet?.title ?? item.id,
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
      canonicalUrl: channel.canonicalUrl,
    };
  }

  if (!channel.handle) {
    throw new Error("Channel handle is required for handle-based resolution.");
  }

  const searchResponse = await client.get<SearchChannelResponse>("/search", {
    params: {
      part: "snippet",
      maxResults: 5,
      q: channel.handle,
      type: "channel",
    },
  });

  const exactHandle = searchResponse.items?.find((item) => item.id?.channelId);
  const channelId = exactHandle?.id?.channelId;
  if (!channelId) {
    throw new Error(`Channel not found for handle @${channel.handle}.`);
  }

  const canonical = resolveChannel(`https://www.youtube.com/channel/${channelId}`);
  return resolveChannelLookup(client, canonical);
}

export async function fetchTopChannelVideos(
  client: YouTubeClient,
  request: ListChannelVideosRequest,
): Promise<FilterableVideo[]> {
  const channelLookup = await resolveChannelLookup(client, request.channel);

  if (!channelLookup.uploadsPlaylistId) {
    return [];
  }

  const playlistItems = await client.get<PlaylistItemsResponse>("/playlistItems", {
    params: {
      part: "contentDetails",
      maxResults: request.filters.limit,
      playlistId: channelLookup.uploadsPlaylistId,
    },
  });

  const videoIds = Array.from(
    new Set((playlistItems.items ?? []).map((item) => item.contentDetails?.videoId).filter(Boolean)),
  ) as string[];

  if (videoIds.length === 0) {
    return [];
  }

  const videosResponse = await client.get<VideosResponse>("/videos", {
    params: {
      part: "snippet,status,statistics,contentDetails,liveStreamingDetails",
      id: videoIds.join(","),
      maxResults: videoIds.length,
    },
  });

  const normalized = (videosResponse.items ?? [])
    .map((item): FilterableVideo | undefined => {
      if (!item.id || !item.snippet?.channelId || !item.contentDetails?.duration) {
        return undefined;
      }

      return {
        id: item.id,
        title: item.snippet.title ?? item.id,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        publishedAt: item.snippet.publishedAt ?? "",
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle ?? channelLookup.title,
        duration: item.contentDetails.duration,
        privacyStatus: item.status?.privacyStatus,
        liveBroadcastContent: item.snippet.liveBroadcastContent,
        hasLiveStreamingDetails: Boolean(item.liveStreamingDetails),
      };
    })
    .filter((item): item is FilterableVideo => item !== undefined);

  return filterChannelVideos(normalized, request.filters)
    .sort((left, right) => right.viewCount - left.viewCount || right.commentCount - left.commentCount)
    .slice(0, Math.max(1, Math.min(5, request.filters.limit)));
}
