import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runCli", () => {
  it("exposes LinkedIn research as a config-driven command", async () => {
    const {runCli} = await import("../src/cli/index.js");
    await expect(runCli([])).resolves.toContain("linkedin-crawl --config <path>");
    await expect(runCli(["linkedin-crawl"])).rejects.toThrow("--config is required");
  });

  it("checks YouTube client wiring from the CLI", async () => {
    const createYouTubeClient = vi.fn(() => ({
      get: vi.fn(async () => ({
        items: [{ id: "dQw4w9WgXcQ", snippet: { title: "Test Video" } }],
      })),
    }));

    vi.doMock("../src/youtube/client.js", () => ({
      createYouTubeClient,
    }));

    vi.stubEnv("YOUTUBE_API_KEY", "test-key");

    const { runCli } = await import("../src/cli/index.js");

    await expect(runCli(["check:youtube"])).resolves.toBe("YouTube API OK: dQw4w9WgXcQ Test Video");
    expect(createYouTubeClient).toHaveBeenCalledWith({
      apiKey: "test-key",
    });
  });

  it("rejects YouTube checks without an API key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");

    const { runCli } = await import("../src/cli/index.js");

    await expect(runCli(["check:youtube"])).rejects.toThrow("YOUTUBE_API_KEY is required.");
  });

  it("loads a scrape job file and fetches comments for video jobs", async () => {
    const loadJobFromFile = vi.fn(async () => ({
      source: {
        type: "video",
        videoId: "video-123",
      },
      selection: {
        topCommentsLimit: 25,
        commentFetchLimit: 100,
      },
      ranking: {
        likesWeight: 1,
        repliesWeight: 3,
      },
      output: {
        writeFlow: false,
        writeMarkdown: true,
        writeRawJson: true,
      },
    }));
    const get = vi.fn(async (endpoint: string) => {
      if (endpoint === "/videos") {
        return {
          items: [
            {
              id: "video-123",
              snippet: {
                title: "Video 123",
                channelId: "channel-1",
                channelTitle: "Channel One",
                publishedAt: "2026-04-20T00:00:00.000Z",
                liveBroadcastContent: "none",
              },
              status: {
                privacyStatus: "public",
              },
              statistics: {
                viewCount: "1000",
                likeCount: "20",
                commentCount: "200",
              },
              contentDetails: {
                duration: "PT10M",
              },
            },
          ],
        };
      }

      return { items: [] };
    });
    const createYouTubeClient = vi.fn(() => ({
      get,
    }));
    const fetchBestYouTubeCommentThreads = vi.fn(async () => ({
      videoId: "video-123",
      threads: [
        {
          id: "thread-1",
          totalReplyCount: 2,
          topLevelComment: {
            id: "comment-1",
            textDisplay: "Comment 1",
            textOriginal: "Comment 1",
            publishedAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
            likeCount: 2,
            author: { displayName: "Ada" },
          },
        },
        {
          id: "thread-2",
          totalReplyCount: 1,
          topLevelComment: {
            id: "comment-2",
            textDisplay: "Comment 2",
            textOriginal: "Comment 2",
            publishedAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
            likeCount: 3,
            author: { displayName: "Bob" },
          },
        },
      ],
      fetches: {
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
      },
    }));
    const writeDeterministicJson = vi.fn(async () => "json-file");
    const writeMarkdown = vi.fn(async () => "md-file");
    const writeFlow = vi.fn(async () => "flow-file");
    const ensureAllCommentsDir = vi.fn(async () => "output/ALL COMMENTS");
    const ensureJobDir = vi.fn(async () => ({
      jobSlug: "video-123",
      jobDir: "output/video-123",
      rootDir: "output",
      jobFile: "output/video-123/job.json",
      videosFile: "output/video-123/videos.json",
      commentsRawFile: "output/video-123/comments.raw.json",
      commentsScoredFile: "output/video-123/comments.scored.json",
      commentsMarkdownFile: "output/video-123/comments.md",
      flowFile: "output/video-123/flow.md",
    }));
    const getAllCommentsMarkdownPath = vi.fn(() => "output/ALL COMMENTS/video-123.md");

    vi.doMock("../src/config/load-job.js", () => ({
      loadJobFromFile,
    }));
    vi.doMock("../src/youtube/client.js", () => ({
      createYouTubeClient,
    }));
    vi.doMock("../src/youtube/fetch-comments.js", () => ({
      fetchBestYouTubeCommentThreads,
    }));
    vi.doMock("../src/export/write-json.js", () => ({
      writeDeterministicJson,
    }));
    vi.doMock("../src/export/write-markdown.js", () => ({
      writeMarkdown,
    }));
    vi.doMock("../src/export/write-flow.js", () => ({
      writeFlow,
    }));
    vi.doMock("../src/utils/job-paths.js", () => ({
      ensureAllCommentsDir,
      ensureJobDir,
      getAllCommentsMarkdownPath,
    }));

    vi.stubEnv("YOUTUBE_API_KEY", "test-key");

    const { runCli } = await import("../src/cli/index.js");

    await expect(runCli(["scrape", "--job-file", "input/jobs/demo.json"])).resolves.toBe(
      "Scrape complete. Videos: 1. Output: output/video-123",
    );
    expect(loadJobFromFile).toHaveBeenCalledWith("input/jobs/demo.json");
    expect(createYouTubeClient).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(fetchBestYouTubeCommentThreads).toHaveBeenCalledWith(
      createYouTubeClient.mock.results[0]?.value,
      {
        maxPages: 1,
        pageSize: 100,
        textFormat: "plainText",
        videoId: "video-123",
      },
    );
    expect(ensureAllCommentsDir).toHaveBeenCalledWith(expect.stringMatching(/output$/));
    expect(getAllCommentsMarkdownPath).toHaveBeenCalledWith(
      path.resolve(process.cwd(), "output"),
      "Video 123",
      "video-123",
    );
    expect(writeMarkdown).toHaveBeenCalledWith("output/ALL COMMENTS/video-123.md", expect.stringContaining("```yaml"));
    expect(writeDeterministicJson).toHaveBeenCalled();
  });

  it("rejects scrape jobs without a --job-file argument", async () => {
    const { runCli } = await import("../src/cli/index.js");

    await expect(runCli(["scrape"])).rejects.toThrow("The scrape command requires --job-file <path>.");
  });
});
