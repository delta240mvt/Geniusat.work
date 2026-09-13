export interface ResolvedChannel {
  kind: "channel";
  bootstrapBy: "handle" | "channel-id";
  handle?: string;
  channelId?: string;
  canonicalUrl: string;
}

const CHANNEL_INPUT_ERROR =
  "Only @handle and /channel/<id> YouTube inputs are supported for bootstrap resolution.";

export function resolveChannel(input: string): ResolvedChannel {
  const trimmed = input.trim();

  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).trim();

    if (handle.length === 0) {
      throw new Error(CHANNEL_INPUT_ERROR);
    }

    return {
      kind: "channel",
      bootstrapBy: "handle",
      handle,
      canonicalUrl: `https://www.youtube.com/@${handle}`,
    };
  }

  const url = parseYouTubeUrl(trimmed);
  if (url && isYouTubeHost(url.hostname)) {
    const handleMatch = url.pathname.match(/^\/@([^/?#]+)\/?$/);
    if (handleMatch?.[1]) {
      return {
        kind: "channel",
        bootstrapBy: "handle",
        handle: handleMatch[1],
        canonicalUrl: `https://www.youtube.com/@${handleMatch[1]}`,
      };
    }
  }
  const channelId = url ? resolveChannelIdFromUrl(url) : resolveChannelIdFromPath(trimmed);

  if (!channelId) {
    throw new Error(CHANNEL_INPUT_ERROR);
  }

  return {
    kind: "channel",
    bootstrapBy: "channel-id",
    channelId,
    canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
  };
}

function parseYouTubeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function resolveChannelIdFromUrl(url: URL): string | null {
  if (!isYouTubeHost(url.hostname)) {
    return null;
  }

  return resolveChannelIdFromPath(url.pathname);
}

function resolveChannelIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/channel\/([^/?#]+)\/?$/);
  return match?.[1] ?? null;
}

function isYouTubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com";
}

export interface ChannelLookupResult {
  channelId: string;
  title: string;
  uploadsPlaylistId?: string;
  canonicalUrl: string;
}
