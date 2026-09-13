import { fileURLToPath } from "node:url";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadJobFromFile } from "../src/config/load-job.js";
import { parseJob, jobSchema } from "../src/config/schema.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const jobsDir = path.resolve(testDir, "../input/jobs");

describe("jobSchema", () => {
  it("parses a video job and applies defaults", () => {
    const job = parseJob({
      source: {
        type: "video",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });

    expect(job.source.type).toBe("video");
    if (job.source.type !== "video") {
      throw new Error("Expected a video job");
    }
    expect(job.source.videoUrl).toContain("youtube.com/watch");
    expect(job.selection).toEqual({
      channelCandidateLimit: 50,
      channelSelectedVideosLimit: 5,
      commentFetchLimit: 200,
      excludeLive: true,
      excludeShorts: true,
      topCommentsLimit: 100,
      topVideosLimit: 5,
      videoSort: "viewCount",
    });
    expect(job.ranking).toEqual({
      likesWeight: 1,
      repliesWeight: 3,
    });
    expect(job.output).toEqual({
      writeFlow: true,
      writeMarkdown: true,
      writeRawJson: true,
    });
  });

  it("parses a channel job with explicit selection overrides", () => {
    const result = jobSchema.parse({
      source: {
        type: "channel",
        channelUrl: "https://www.youtube.com/@openai",
      },
      selection: {
        topCommentsLimit: 25,
        topVideosLimit: 3,
        excludeShorts: false,
      },
    });

    expect(result.source).toEqual({
      type: "channel",
      channelUrl: "https://www.youtube.com/@openai",
    });
    expect(result.selection.topCommentsLimit).toBe(25);
    expect(result.selection.topVideosLimit).toBe(3);
    expect(result.selection.excludeShorts).toBe(false);
    expect(result.selection.excludeLive).toBe(true);
  });

  it("rejects video jobs without a video identifier", () => {
    const result = jobSchema.safeParse({
      source: {
        type: "video",
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected schema parsing to fail");
    }
    expect(result.error.issues[0]?.message).toContain("videoUrl");
  });
});

describe("loadJobFromFile", () => {
  it("loads and validates the sample video fixture", async () => {
    const job = await loadJobFromFile(path.join(jobsDir, "sample-video.json"));

    expect(job.source.type).toBe("video");
    if (job.source.type !== "video") {
      throw new Error("Expected a video job");
    }
    expect(job.source.videoId).toBe("dQw4w9WgXcQ");
  });

  it("loads and validates the sample channel fixture", async () => {
    const job = await loadJobFromFile(path.join(jobsDir, "sample-channel.json"));

    expect(job.source.type).toBe("channel");
    if (job.source.type !== "channel") {
      throw new Error("Expected a channel job");
    }
    expect(job.source.channelUrl).toBe("https://www.youtube.com/@openai");
  });
});
