import { describe, expect, it } from "vitest";

import { normalizeComment } from "../src/normalize/index.js";
import { rankComments, selectTopComment, selectTopComments } from "../src/ranking/index.js";

const NOW = "2026-04-22T12:00:00.000Z";

describe("normalizeComment", () => {
  it("normalizes whitespace, clamps metrics, and derives stable fields", () => {
    const normalized = normalizeComment(
      {
        id: "comment-1",
        author: "Ada",
        text: "  Build   something   useful \n fast  ",
        likeCount: -3,
        replyCount: 2.9,
        publishedAt: "2026-04-22T10:00:00.000Z",
      },
      { now: NOW },
    );

    expect(normalized).toMatchObject({
      id: "comment-1",
      author: "Ada",
      text: "Build something useful fast",
      likeCount: 0,
      replyCount: 2,
      charCount: 27,
      wordCount: 4,
      ageHours: 2,
      publishedAt: "2026-04-22T10:00:00.000Z",
    });
  });
});

describe("rankComments", () => {
  it("ranks comments by engagement score and stable tie-breakers", () => {
    const ranked = rankComments(
      [
        {
          id: "gamma",
          author: "Grace",
          text: "Clear walkthrough with practical examples for the team.",
          likeCount: 6,
          replyCount: 4,
          publishedAt: "2026-04-22T11:00:00.000Z",
        },
        {
          id: "alpha",
          author: "Linus",
          text: "Pinned note from the creator.",
          likeCount: 5,
          replyCount: 1,
          isPinned: true,
          publishedAt: "2026-04-22T07:00:00.000Z",
        },
        {
          id: "beta",
          author: "Margaret",
          text: "Great point.",
          likeCount: 6,
          replyCount: 4,
          publishedAt: "2026-04-22T11:00:00.000Z",
        },
      ],
      { now: NOW },
    );

    expect(ranked.map((entry) => entry.id)).toEqual(["beta", "gamma", "alpha"]);
    expect(ranked[0]?.engagementScore).toBe(ranked[1]?.engagementScore);
    expect(ranked[0]?.engagementScore).toBeGreaterThan(ranked[2]?.engagementScore ?? 0);
    expect(ranked[0]?.whySelected).toBe("active discussion");
    expect(ranked[1]?.whySelected).toBe("active discussion");
    expect(ranked[2]?.whySelected).toBe("useful signal");
  });
});

describe("selectTopComment", () => {
  it("returns the top ranked comment with a short whySelected string", () => {
    const selected = selectTopComment(
      [
        {
          id: "first",
          author: "Sofia",
          text: "This solves the main problem and explains the tradeoff clearly.",
          likeCount: 8,
          replyCount: 3,
          publishedAt: "2026-04-22T09:00:00.000Z",
        },
        {
          id: "second",
          author: "Turing",
          text: "Pinned summary.",
          likeCount: 1,
          replyCount: 0,
          isPinned: true,
          publishedAt: "2026-04-22T08:00:00.000Z",
        },
      ],
      { now: NOW },
    );

    expect(selected).not.toBeNull();
    expect(selected).toMatchObject({
      id: "first",
      whySelected: "active discussion",
    });
    expect(selected?.whySelected.length).toBeLessThanOrEqual(32);
  });

  it("returns null for an empty list", () => {
    expect(selectTopComment([], { now: NOW })).toBeNull();
  });

  it("limits the selected comments count", () => {
    const selected = selectTopComments(
      [
        { id: "a", author: "A", text: "a", likeCount: 1, replyCount: 0, publishedAt: NOW },
        { id: "b", author: "B", text: "b", likeCount: 2, replyCount: 0, publishedAt: NOW },
        { id: "c", author: "C", text: "c", likeCount: 3, replyCount: 0, publishedAt: NOW },
      ],
      2,
      { now: NOW },
    );

    expect(selected.map((comment) => comment.id)).toEqual(["c", "b"]);
  });
});
