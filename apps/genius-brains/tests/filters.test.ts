import { describe, expect, it } from "vitest";

import { filterChannelVideos, normalizeChannelVideoFilters } from "../src/youtube/filters.js";

describe("normalizeChannelVideoFilters", () => {
  it("applies bootstrap defaults", () => {
    expect(normalizeChannelVideoFilters()).toEqual({
      limit: 25,
      includeShorts: true,
      includeLive: false,
    });
  });

  it("preserves explicit values within the supported range", () => {
    expect(
      normalizeChannelVideoFilters({
        limit: 50,
        includeShorts: false,
        includeLive: true,
      }),
    ).toEqual({
      limit: 50,
      includeShorts: false,
      includeLive: true,
    });
  });

  it("rejects invalid limits", () => {
    expect(() => normalizeChannelVideoFilters({ limit: 0 })).toThrow(
      "YouTube channel video limit must be between 1 and 50.",
    );
  });

  it("filters out non-public, live, and shorts-like videos", () => {
    const filtered = filterChannelVideos(
      [
        {
          id: "keep",
          title: "Keep",
          viewCount: 100,
          commentCount: 10,
          likeCount: 5,
          publishedAt: "2026-04-22T00:00:00.000Z",
          channelId: "c1",
          channelTitle: "Chan",
          duration: "PT10M",
          privacyStatus: "public",
          liveBroadcastContent: "none",
          hasLiveStreamingDetails: false,
        },
        {
          id: "live",
          title: "Live",
          viewCount: 1000,
          commentCount: 10,
          likeCount: 5,
          publishedAt: "2026-04-22T00:00:00.000Z",
          channelId: "c1",
          channelTitle: "Chan",
          duration: "PT30M",
          privacyStatus: "public",
          liveBroadcastContent: "live",
          hasLiveStreamingDetails: true,
        },
        {
          id: "short",
          title: "Short",
          viewCount: 2000,
          commentCount: 10,
          likeCount: 5,
          publishedAt: "2026-04-22T00:00:00.000Z",
          channelId: "c1",
          channelTitle: "Chan",
          duration: "PT45S",
          privacyStatus: "public",
          liveBroadcastContent: "none",
          hasLiveStreamingDetails: false,
        },
      ],
      {
        limit: 50,
        includeLive: false,
        includeShorts: false,
      },
    );

    expect(filtered.map((video) => video.id)).toEqual(["keep"]);
  });
});
