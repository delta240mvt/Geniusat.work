const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";

export type YouTubeFetch = typeof fetch;

export interface YouTubeClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: YouTubeFetch;
}

export interface YouTubeRequestOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

interface YouTubeApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      domain?: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export class YouTubeApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly details: ReadonlyArray<{
    domain?: string;
    reason?: string;
    message?: string;
  }>;

  constructor(args: {
    message: string;
    status: number;
    endpoint: string;
    details?: ReadonlyArray<{
      domain?: string;
      reason?: string;
      message?: string;
    }>;
  }) {
    super(args.message);
    this.name = "YouTubeApiError";
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.details = args.details ?? [];
  }
}

export interface YouTubeClient {
  get<TResponse>(path: string, options?: YouTubeRequestOptions): Promise<TResponse>;
}

export function createYouTubeClient(options: YouTubeClientOptions): YouTubeClient {
  const apiKey = options.apiKey.trim();

  if (!apiKey) {
    throw new Error("YouTube API key is required.");
  }

  const baseUrl = (options.baseUrl ?? YOUTUBE_API_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to call the YouTube API.");
  }

  return {
    async get<TResponse>(path: string, requestOptions: YouTubeRequestOptions = {}): Promise<TResponse> {
      const url = buildUrl(baseUrl, path, {
        ...requestOptions.params,
        key: apiKey,
      });

      const response = await fetchImpl(url, {
        method: "GET",
        signal: requestOptions.signal,
      });

      const payload = (await parseJson(response)) as TResponse | YouTubeApiErrorPayload | undefined;

      if (!response.ok) {
        throw toYouTubeApiError(response.status, url, payload);
      }

      return payload as TResponse;
    },
  };
}

function buildUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      error: {
        code: response.status,
        message: text,
      },
    } satisfies YouTubeApiErrorPayload;
  }
}

function toYouTubeApiError(status: number, endpoint: string, payload: unknown): YouTubeApiError {
  const apiPayload = isYouTubeApiErrorPayload(payload) ? payload : undefined;
  const message = apiPayload?.error?.message ?? `YouTube API request failed with status ${status}.`;

  return new YouTubeApiError({
    message,
    status,
    endpoint,
    details: apiPayload?.error?.errors,
  });
}

function isYouTubeApiErrorPayload(value: unknown): value is YouTubeApiErrorPayload {
  return typeof value === "object" && value !== null && "error" in value;
}
