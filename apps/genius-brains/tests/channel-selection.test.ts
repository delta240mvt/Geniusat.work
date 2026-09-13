import {describe, expect, it} from "vitest";

import {filterChannelVideos} from "../src/youtube/filters.js";

describe("channel video selection", () => {
  it("keeps the highest-view public long-form videos after filtering", () => {
    const selected = filterChannelVideos(
      [
        {
          id: "video-1",
          title: "Video 1",
          viewCount: 10,
          commentCount: 1,
          likeCount: 1,
          publishedAt: "2026-04-20T00:00:00.000Z",
          channelId: "channel-1",
          channelTitle: "Channel",
          duration: "PT5M",
          privacyStatus: "public",
          liveBroadcastContent: "none",
          hasLiveStreamingDetails: false,
        },
        {
          id: "video-2",
          title: "Video 2",
          viewCount: 500,
          commentCount: 10,
          likeCount: 3,
          publishedAt: "2026-04-19T00:00:00.000Z",
          channelId: "channel-1",
          channelTitle: "Channel",
          duration: "PT2M",
          privacyStatus: "public",
          liveBroadcastContent: "none",
          hasLiveStreamingDetails: false,
        },
        {
          id: "video-live",
          title: "Live",
          viewCount: 999,
          commentCount: 50,
          likeCount: 20,
          publishedAt: "2026-04-18T00:00:00.000Z",
          channelId: "channel-1",
          channelTitle: "Channel",
          duration: "PT50M",
          privacyStatus: "public",
          liveBroadcastContent: "live",
          hasLiveStreamingDetails: true,
        },
      ],
      {
        limit: 50,
        includeLive: false,
        includeShorts: false,
      },
    )
      .sort((left, right) => right.viewCount - left.viewCount)
      .slice(0, 2);

    expect(selected.map((video) => video.id)).toEqual(["video-2", "video-1"]);
  });
});
