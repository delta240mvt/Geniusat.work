import { mkdir } from "node:fs/promises";
import path from "node:path";

export type JobPaths = {
  rootDir: string;
  jobSlug: string;
  jobDir: string;
  jobFile: string;
  videosFile: string;
  commentsRawFile: string;
  commentsScoredFile: string;
  commentsMarkdownFile: string;
  flowFile: string;
};

export function getJobPaths(rootDir: string, jobName: string, videoId?: string): JobPaths {
  const jobSlug = slugifyJobName(jobName, videoId);
  const jobDir = path.join(rootDir, jobSlug);

  return {
    rootDir,
    jobSlug,
    jobDir,
    jobFile: path.join(jobDir, "job.json"),
    videosFile: path.join(jobDir, "videos.json"),
    commentsRawFile: path.join(jobDir, "comments.raw.json"),
    commentsScoredFile: path.join(jobDir, "comments.scored.json"),
    commentsMarkdownFile: path.join(jobDir, "comments.md"),
    flowFile: path.join(jobDir, "flow.md"),
  };
}

export async function ensureJobDir(rootDir: string, jobName: string, videoId?: string): Promise<JobPaths> {
  const paths = getJobPaths(rootDir, jobName, videoId);
  await mkdir(paths.jobDir, { recursive: true });
  return paths;
}

export function getAllCommentsDir(rootDir: string): string {
  return path.join(rootDir, "ALL COMMENTS");
}

export function getAllCommentsMarkdownPath(rootDir: string, jobName: string, videoId?: string): string {
  const jobSlug = slugifyJobName(jobName, videoId);
  return path.join(getAllCommentsDir(rootDir), `${jobSlug}.md`);
}

export async function ensureAllCommentsDir(rootDir: string): Promise<string> {
  const allCommentsDir = getAllCommentsDir(rootDir);
  await mkdir(allCommentsDir, { recursive: true });
  return allCommentsDir;
}

function slugifyJobName(jobName: string, videoId?: string): string {
  const slug = jobName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug) {
    return slug;
  }

  if (videoId?.trim()) {
    return `video-${videoId.trim().toLowerCase()}`;
  }

  return "job";
}
