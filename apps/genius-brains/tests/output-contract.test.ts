import {describe, expect, it} from "vitest";

import {selectTopComments} from "../src/ranking/index.js";

describe("output contract", () => {
  it("produces short whySelected strings for downstream artifacts", () => {
    const [comment] = selectTopComments(
      [
        {
          id: "comment-1",
          author: "Ada",
          text: "Very useful point for the thread.",
          likeCount: 200,
          replyCount: 20,
          publishedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      1,
    );

    expect(comment.whySelected.length).toBeLessThanOrEqual(32);
  });

  it("sorts by engagementScore desc, then likeCount desc, then publishedAt asc, then id asc", () => {
    const selected = selectTopComments(
      [
        {
          id: "b",
          author: "Author B",
          text: "Comment B",
          likeCount: 10,
          replyCount: 5,
          publishedAt: "2026-04-20T01:00:00.000Z",
        },
        {
          id: "a",
          author: "Author A",
          text: "Comment A",
          likeCount: 10,
          replyCount: 5,
          publishedAt: "2026-04-20T01:00:00.000Z",
        },
        {
          id: "c",
          author: "Author C",
          text: "Comment C",
          likeCount: 8,
          replyCount: 5,
          publishedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      3,
      {
        likesWeight: 1,
        repliesWeight: 3,
      },
    );

    expect(selected.map((comment) => comment.id)).toEqual(["a", "b", "c"]);
  });
});
