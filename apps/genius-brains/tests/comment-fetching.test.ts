import { describe, expect, it } from "vitest";

import type { YouTubeClient } from "../src/youtube/client.js";
import type { YouTubeRequestOptions } from "../src/youtube/client.js";
import { fetchBestYouTubeCommentThreads } from "../src/youtube/fetch-comments.js";

describe("fetchBestYouTubeCommentThreads", () => {
  it("merges relevance and time results, dedupes by top-level comment id, and prefers higher engagement", async () => {
    const client: YouTubeClient = {
      get: async <TResponse,>(_path: string, options?: YouTubeRequestOptions) => {
        const order = String(options?.params?.order ?? "");

        if (order === "relevance") {
          return {
            items: [
              makeThread("comment-a", "A", 50, 2, "2026-04-20T00:00:00.000Z"),
              makeThread("comment-b", "B", 5, 0, "2026-04-20T01:00:00.000Z"),
            ],
            pageInfo: { totalResults: 2, resultsPerPage: 2 },
          } as TResponse;
        }

        if (order === "time") {
          return {
            items: [
              makeThread("comment-b", "B", 5, 0, "2026-04-20T01:00:00.000Z"),
              makeThread("comment-c", "C", 25, 4, "2026-04-19T00:00:00.000Z"),
            ],
            pageInfo: { totalResults: 2, resultsPerPage: 2 },
          } as TResponse;
        }

        throw new Error(`Unexpected order: ${order}`);
      },
    };

    const result = await fetchBestYouTubeCommentThreads(client, {
      videoId: "video-123",
      pageSize: 100,
      maxPages: 1,
      textFormat: "plainText",
    });

    expect(result.threads.map((thread) => thread.topLevelComment.id)).toEqual(["comment-a", "comment-c", "comment-b"]);
    expect(result.fetches).toEqual({
      relevance: {
        commentsFetched: 2,
        exhausted: true,
        pagesFetched: 1,
      },
      time: {
        commentsFetched: 2,
        exhausted: true,
        pagesFetched: 1,
      },
    });
  });
});

function makeThread(id: string, text: string, likeCount: number, replyCount: number, publishedAt: string) {
  return {
    id: `thread-${id}`,
    snippet: {
      videoId: "video-123",
      canReply: true,
      isPublic: true,
      totalReplyCount: replyCount,
      topLevelComment: {
        id,
        snippet: {
          textDisplay: text,
          textOriginal: text,
          publishedAt,
          updatedAt: publishedAt,
          likeCount,
          authorDisplayName: `Author ${id}`,
        },
      },
    },
  };
}
