import { describe, expect, it } from "vitest";

import { renderAllCommentsMarkdown } from "../src/export/render-all-comments-markdown.js";

describe("renderAllCommentsMarkdown", () => {
  it("renders one yaml fenced block per comment without run-level wrapper data", () => {
    const markdown = renderAllCommentsMarkdown([
      {
        ageHours: 12,
        author: "@Ada",
        channelId: "channel-1",
        channelTitle: "Channel One",
        charCount: 11,
        commentId: "comment-1",
        engagementScore: 22,
        id: "comment-1",
        isPinned: false,
        likeCount: 10,
        publishedAt: "2026-04-20T00:00:00.000Z",
        publishedAtMs: 1760000000000,
        replyCount: 4,
        sourceUrl: "https://youtube.test/comment-1",
        text: "Hello world",
        videoId: "video-1",
        videoTitle: "Video One",
        whySelected: "active discussion",
        wordCount: 2,
      },
      {
        ageHours: 10,
        author: "@Bob",
        channelId: "channel-1",
        channelTitle: "Channel One",
        charCount: 14,
        commentId: "comment-2",
        engagementScore: 8,
        id: "comment-2",
        isPinned: true,
        likeCount: 2,
        publishedAt: "2026-04-20T02:00:00.000Z",
        publishedAtMs: 1760007200000,
        replyCount: 2,
        sourceUrl: "https://youtube.test/comment-2",
        text: "Second comment",
        videoId: "video-1",
        videoTitle: "Video One",
        whySelected: "useful signal",
        wordCount: 2,
      },
    ]);

    expect(markdown).toContain("```yaml");
    expect(markdown).toContain('commentId: "comment-1"');
    expect(markdown).toContain('text: |');
    expect(markdown).toContain('  Hello world');
    expect(markdown).toContain('isPinned: true');
    expect(markdown).not.toContain("generatedAt");
    expect(markdown).not.toContain("videos:");
    expect(markdown.match(/```yaml/g)?.length).toBe(2);
  });
});
