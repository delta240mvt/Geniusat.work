import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { writeFlow } from "../src/export/write-flow.js";
import { writeDeterministicJson } from "../src/export/write-json.js";
import { writeMarkdown } from "../src/export/write-markdown.js";
import { ensureAllCommentsDir, ensureJobDir, getAllCommentsMarkdownPath, getJobPaths } from "../src/utils/job-paths.js";

describe("job export utilities", () => {
  it("builds deterministic job folder and artifact paths", () => {
    const rootDir = path.join("C:", "exports");
    const paths = getJobPaths(rootDir, " Client Onboarding / Draft #1 ");

    expect(paths.jobSlug).toBe("client-onboarding-draft-1");
    expect(paths.jobDir).toBe(path.join(rootDir, "client-onboarding-draft-1"));
    expect(paths.jobFile).toBe(path.join(rootDir, "client-onboarding-draft-1", "job.json"));
    expect(paths.videosFile).toBe(path.join(rootDir, "client-onboarding-draft-1", "videos.json"));
    expect(paths.commentsRawFile).toBe(path.join(rootDir, "client-onboarding-draft-1", "comments.raw.json"));
    expect(paths.commentsScoredFile).toBe(path.join(rootDir, "client-onboarding-draft-1", "comments.scored.json"));
    expect(paths.commentsMarkdownFile).toBe(path.join(rootDir, "client-onboarding-draft-1", "comments.md"));
    expect(paths.flowFile).toBe(path.join(rootDir, "client-onboarding-draft-1", "flow.md"));
  });

  it("builds YouTube-style slug folders and all-comments markdown paths", () => {
    const rootDir = path.join("C:", "exports");
    const paths = getJobPaths(rootDir, "Vibe Coding with Gemini 3 in Google AI Studio", "meUr8fjy8lQ");
    const allCommentsFile = getAllCommentsMarkdownPath(rootDir, "Vibe Coding with Gemini 3 in Google AI Studio", "meUr8fjy8lQ");

    expect(paths.jobSlug).toBe("vibe-coding-with-gemini-3-in-google-ai-studio");
    expect(paths.jobDir).toBe(path.join(rootDir, "vibe-coding-with-gemini-3-in-google-ai-studio"));
    expect(allCommentsFile).toBe(
      path.join(rootDir, "ALL COMMENTS", "vibe-coding-with-gemini-3-in-google-ai-studio.md"),
    );
  });

  it("falls back to a unique slug with video id when titles collide or slugify to empty", () => {
    const rootDir = path.join("C:", "exports");
    const duplicatePaths = getJobPaths(rootDir, "!!!", "abc123");
    const allCommentsFile = getAllCommentsMarkdownPath(rootDir, "!!!", "abc123");

    expect(duplicatePaths.jobSlug).toBe("video-abc123");
    expect(duplicatePaths.jobDir).toBe(path.join(rootDir, "video-abc123"));
    expect(allCommentsFile).toBe(path.join(rootDir, "ALL COMMENTS", "video-abc123.md"));
  });

  it("creates the job directory when ensuring paths", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "genius-brains-job-paths-"));

    try {
      const paths = await ensureJobDir(rootDir, "Launch Plan");
      const jobStats = await stat(paths.jobDir);

      expect(jobStats.isDirectory()).toBe(true);
      expect(paths.jobSlug).toBe("launch-plan");
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it("creates the ALL COMMENTS directory when ensuring paths", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "genius-brains-all-comments-"));

    try {
      const allCommentsDir = await ensureAllCommentsDir(rootDir);
      const dirStats = await stat(allCommentsDir);

      expect(dirStats.isDirectory()).toBe(true);
      expect(allCommentsDir).toBe(path.join(rootDir, "ALL COMMENTS"));
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it("writes JSON with stable key ordering", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "genius-brains-json-"));
    const filePath = path.join(rootDir, "nested", "export.json");

    try {
      await writeDeterministicJson(filePath, {
        z: 1,
        nested: {
          b: 2,
          a: 1,
        },
        arr: [
          {
            d: 4,
            c: 3,
          },
          "x",
        ],
      });

      await expect(readFile(filePath, "utf8")).resolves.toBe(`{
  "arr": [
    {
      "c": 3,
      "d": 4
    },
    "x"
  ],
  "nested": {
    "a": 1,
    "b": 2
  },
  "z": 1
}
`);
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it("writes Markdown with normalized line endings and a trailing newline", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "genius-brains-markdown-"));
    const filePath = path.join(rootDir, "exports", "summary.md");

    try {
      await writeMarkdown(filePath, "# Summary\r\n\r\nLine one\r\nLine two");

      await expect(readFile(filePath, "utf8")).resolves.toBe(`# Summary

Line one
Line two
`);
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it("writes flow documents with stable metadata and edge ordering", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "genius-brains-flow-"));
    const filePath = path.join(rootDir, "exports", "pipeline.flow.md");

    try {
      await writeFlow(filePath, {
        title: "Publishing Flow",
        description: "Moves a script from idea to export.",
        metadata: {
          priority: 2,
          owner: "brains",
        },
        steps: [
          {
            id: "draft",
            title: "Draft script",
            next: ["review", "export"],
            notes: ["Collect source ideas"],
          },
          {
            id: "review",
            title: "Review draft",
            next: ["export"],
          },
          {
            id: "export",
            title: "Export assets",
          },
        ],
      });

      await expect(readFile(filePath, "utf8")).resolves.toBe(`# Publishing Flow

Moves a script from idea to export.

## Metadata
- owner: brains
- priority: 2

## Steps
1. \`draft\` - Draft script
   Next: export, review
   - Collect source ideas
2. \`review\` - Review draft
   Next: export
3. \`export\` - Export assets
`);
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });
});
