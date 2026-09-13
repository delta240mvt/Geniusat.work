import type { ChannelVideoFiltersInput } from "./filters.js";
import { listChannelVideos, type ListChannelVideosRequest } from "./list-channel-videos.js";
import { resolveChannel, type ResolvedChannel } from "./resolve-channel.js";

export interface ChannelBootstrapResolution {
  kind: "channel-bootstrap";
  input: string;
  channel: ResolvedChannel;
  request: ListChannelVideosRequest;
}

export function resolveVideo(
  input: string,
  filters?: ChannelVideoFiltersInput,
): ChannelBootstrapResolution {
  const channel = resolveChannel(input);

  return {
    kind: "channel-bootstrap",
    input,
    channel,
    request: listChannelVideos(channel, filters),
  };
}

export function extractVideoId(input: string): string {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Unsupported YouTube video input.");
  }

  if (!isYouTubeHost(url.hostname)) {
    throw new Error("Unsupported YouTube video input.");
  }

  if (url.hostname === "youtu.be") {
    const shortId = url.pathname.replace(/^\/+/, "").split("/")[0];
    if (/^[a-zA-Z0-9_-]{11}$/.test(shortId)) {
      return shortId;
    }
  }

  const directPathMatch = url.pathname.match(/^\/shorts\/([^/?#]+)\/?$/);
  if (directPathMatch?.[1]) {
    return directPathMatch[1];
  }

  const videoId = url.searchParams.get("v");
  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return videoId;
  }

  throw new Error("Unsupported YouTube video input.");
}

function isYouTubeHost(hostname: string): boolean {
  return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(hostname);
}
