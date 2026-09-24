import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({
  path: path.resolve(currentDir, "../../../../.env"),
});

import { loadJobFromFile } from "../config/load-job.js";
import type { Job } from "../config/schema.js";
import { writeFlow } from "../export/write-flow.js";
import { writeDeterministicJson } from "../export/write-json.js";
import { writeMarkdown } from "../export/write-markdown.js";
import { renderAllCommentsMarkdown } from "../export/render-all-comments-markdown.js";
import type { RawComment } from "../normalize/index.js";
import { selectTopComments } from "../ranking/index.js";
import { ensureAllCommentsDir, ensureJobDir, getAllCommentsMarkdownPath } from "../utils/job-paths.js";
import { toIsoTimestamp } from "../utils/time.js";
import { createYouTubeClient, type YouTubeApiError, type YouTubeClient } from "../youtube/client.js";
import { fetchBestYouTubeCommentThreads, fetchYouTubeCommentThreads } from "../youtube/fetch-comments.js";
import { filterChannelVideos, type FilterableVideo } from "../youtube/filters.js";
import { resolveChannelLookup } from "../youtube/list-channel-videos.js";
import { resolveChannel } from "../youtube/resolve-channel.js";
import { extractVideoId } from "../youtube/resolve-video.js";
import { runViralCommand } from "../viral/cli.js";

const HELP_TEXT = [
  "Usage:",
  "  genius-brains crawl --config <path>",
  "  genius-brains linkedin-crawl --config <path> [--run-id <id>]",
  "  genius-brains analyze --run-id <id> [--codex-output <path>]",
  "  genius-brains report --run-id <id>",
  "  genius-brains list-runs",
  "  genius-brains check:youtube [--api-key <key>]",
  "  genius-brains scrape --job-file <path> [--api-key <key>]",
].join("\n");

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<string> {
  const [command, ...rest] = argv;

  switch (command) {
    case "crawl":
    case "linkedin-crawl":
    case "analyze":
    case "report":
    case "list-runs":
      return runViralCommand(command, rest);
    case "check:youtube":
      return runYouTubeCheck(rest);
    case "scrape":
      return runScrape(rest);
    case undefined:
      return HELP_TEXT;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function runYouTubeCheck(argv: string[]): Promise<string> {
  const client = createYouTubeClient({
    apiKey: requireApiKey(argv, 0),
  });

  const response = await client.get<VideoCheckResponse>("/videos", {
    params: {
      part: "snippet",
      id: "dQw4w9WgXcQ",
      maxResults: 1,
    },
  });

  const item = response.items?.[0];
  if (!item?.id) {
    throw new Error("YouTube connectivity check returned no video data.");
  }

  return `YouTube API OK: ${item.id} ${item.snippet?.title ?? ""}`.trim();
}

async function runScrape(argv: string[]): Promise<string> {
  const jobFile = readOption(argv, "--job-file") ?? readPositionalValue(argv, 0);

  if (!jobFile) {
    throw new Error("The scrape command requires --job-file <path>.");
  }

  const job = await loadJobFromFile(jobFile);
  const client = createYouTubeClient({
    apiKey: requireApiKey(argv, 1),
  });

  const selectedVideos = await resolveSelectedVideos(client, job);
  const outputRoot = path.resolve(process.cwd(), "output");
  await ensureAllCommentsDir(outputRoot);
  const startedAt = toIsoTimestamp();

  const rawVideos: RawVideoArtifact[] = [];
  const scoredVideos: ScoredVideoArtifact[] = [];
  let firstOutputDir: string | undefined;

  for (const video of selectedVideos) {
    const jobName = buildJobName(job, video);
    const jobPaths = await ensureJobDir(outputRoot, jobName, video.videoId);
    const allCommentsFile = getAllCommentsMarkdownPath(outputRoot, jobName, video.videoId);

    if (!firstOutputDir) {
      firstOutputDir = jobPaths.jobDir;
    }

    try {
      const fetched = await fetchBestYouTubeCommentThreads(client, {
        videoId: video.videoId,
        pageSize: Math.min(100, job.selection.commentFetchLimit),
        maxPages: Math.max(1, Math.ceil(job.selection.commentFetchLimit / 100)),
        textFormat: "plainText",
      });

      const rawComments = fetched.threads.map<RawComment>((thread) => ({
        id: thread.topLevelComment.id,
        author: thread.topLevelComment.author.displayName,
        text: thread.topLevelComment.textOriginal || thread.topLevelComment.textDisplay,
        likeCount: thread.topLevelComment.likeCount,
        replyCount: thread.totalReplyCount,
        publishedAt: thread.topLevelComment.publishedAt,
      }));

      const scoredComments = selectTopComments(rawComments, job.selection.topCommentsLimit, {
        likesWeight: job.ranking.likesWeight,
        repliesWeight: job.ranking.repliesWeight,
      });

      rawVideos.push({
        videoId: video.videoId,
        title: video.title,
        status: "ok",
        pagesFetched: fetched.fetches.relevance.pagesFetched + fetched.fetches.time.pagesFetched,
        fetchedComments: rawComments.length,
        commentsDisabled: false,
        comments: rawComments,
      });

      scoredVideos.push({
        videoId: video.videoId,
        title: video.title,
        scoring: {
          likesWeight: job.ranking.likesWeight,
          repliesWeight: job.ranking.repliesWeight,
        },
        comments: scoredComments.map((comment) => ({
          ...comment,
          commentId: comment.id,
          videoId: video.videoId,
          videoTitle: video.title,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}&lc=${comment.id}`,
        })),
      });

      const rawVideoArtifact = rawVideos.at(-1);
      const scoredVideoArtifact = scoredVideos.at(-1);

      await writeDeterministicJson(jobPaths.jobFile, {
        completedAt: toIsoTimestamp(),
        jobName,
        output: job.output,
        ranking: job.ranking,
        resolvedSourceType: job.source.type,
        selectedVideoCount: 1,
        selection: job.selection,
        source: job.source,
        startedAt,
      });
      await writeDeterministicJson(jobPaths.videosFile, [video]);
      if (job.output.writeRawJson && rawVideoArtifact) {
        await writeDeterministicJson(jobPaths.commentsRawFile, {
          generatedAt: toIsoTimestamp(),
          videos: [rawVideoArtifact],
        });
      }
      if (scoredVideoArtifact) {
        await writeDeterministicJson(jobPaths.commentsScoredFile, {
          generatedAt: toIsoTimestamp(),
          videos: [scoredVideoArtifact],
        });
      }

      if (job.output.writeMarkdown && scoredVideoArtifact) {
        const markdown = renderCommentsMarkdown([scoredVideoArtifact]);
        const allCommentsMarkdown = renderAllCommentsMarkdown(scoredVideoArtifact.comments);
        await writeMarkdown(jobPaths.commentsMarkdownFile, markdown);
        await writeMarkdown(allCommentsFile, allCommentsMarkdown);
      }

      if (job.output.writeFlow) {
        await writeFlow(jobPaths.flowFile, {
          title: `Genius@Brains Flow - ${jobName}`,
          description: "YouTube comments scrape flow and run summary.",
          metadata: {
            completedAt: toIsoTimestamp(),
            sourceType: job.source.type,
            startedAt,
            videos: 1,
          },
          steps: [
            { id: "load-job", title: "Load and validate job JSON" },
            { id: "resolve-source", title: "Resolve source into target video ids" },
            { id: "fetch-comments", title: "Fetch YouTube comment threads" },
            { id: "rank-comments", title: "Score and select top comments" },
            { id: "write-artifacts", title: "Write JSON, Markdown, and flow outputs" },
          ],
        });
      }
    } catch (error) {
      const rawVideoArtifact: RawVideoArtifact = {
        videoId: video.videoId,
        title: video.title,
        status: "error",
        pagesFetched: 0,
        fetchedComments: 0,
        commentsDisabled: isCommentsDisabledError(error),
        failureReason: toFailureReason(error),
        comments: [],
      };
      rawVideos.push(rawVideoArtifact);

      await writeDeterministicJson(jobPaths.jobFile, {
        completedAt: toIsoTimestamp(),
        jobName,
        output: job.output,
        ranking: job.ranking,
        resolvedSourceType: job.source.type,
        selectedVideoCount: 1,
        selection: job.selection,
        source: job.source,
        startedAt,
      });
      await writeDeterministicJson(jobPaths.videosFile, [video]);
      if (job.output.writeRawJson) {
        await writeDeterministicJson(jobPaths.commentsRawFile, {
          generatedAt: toIsoTimestamp(),
          videos: [rawVideoArtifact],
        });
      }
      await writeDeterministicJson(jobPaths.commentsScoredFile, {
        generatedAt: toIsoTimestamp(),
        videos: [],
      });

      if (job.output.writeMarkdown) {
        const markdown = renderCommentsMarkdown([]);
        const allCommentsMarkdown = renderAllCommentsMarkdown([]);
        await writeMarkdown(jobPaths.commentsMarkdownFile, markdown);
        await writeMarkdown(allCommentsFile, allCommentsMarkdown);
      }

      if (job.output.writeFlow) {
        await writeFlow(jobPaths.flowFile, {
          title: `Genius@Brains Flow - ${jobName}`,
          description: "YouTube comments scrape flow and run summary.",
          metadata: {
            completedAt: toIsoTimestamp(),
            sourceType: job.source.type,
            startedAt,
            videos: 1,
          },
          steps: [
            { id: "load-job", title: "Load and validate job JSON" },
            { id: "resolve-source", title: "Resolve source into target video ids" },
            { id: "fetch-comments", title: "Fetch YouTube comment threads" },
            { id: "rank-comments", title: "Score and select top comments" },
            { id: "write-artifacts", title: "Write JSON, Markdown, and flow outputs" },
          ],
        });
      }
    }
  }

  return `Scrape complete. Videos: ${selectedVideos.length}. Output: ${firstOutputDir ?? outputRoot}`;
}

type SelectedVideo = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  videoUrl: string;
  selectionReason: string;
};

type RawVideoArtifact = {
  videoId: string;
  title: string;
  status: "ok" | "error";
  pagesFetched: number;
  fetchedComments: number;
  commentsDisabled: boolean;
  failureReason?: string;
  comments: RawComment[];
};

type ScoredVideoArtifact = {
  videoId: string;
  title: string;
  scoring: {
    likesWeight: number;
    repliesWeight: number;
  };
  comments: Array<ReturnType<typeof selectTopComments>[number] & {
    commentId: string;
    videoId: string;
    videoTitle: string;
    channelId: string;
    channelTitle: string;
    sourceUrl: string;
  }>;
};

type VideosListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      liveBroadcastContent?: string;
    };
    status?: { privacyStatus?: string };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
    contentDetails?: { duration?: string };
    liveStreamingDetails?: Record<string, unknown>;
  }>;
};

type VideoCheckResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
    };
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{
    contentDetails?: {
      videoId?: string;
    };
  }>;
};

async function resolveSelectedVideos(client: YouTubeClient, job: Job): Promise<SelectedVideo[]> {
  if (job.source.type === "video") {
    const videoId = job.source.videoId?.trim() || extractVideoId(job.source.videoUrl ?? "");
    const [video] = await fetchVideoDetails(client, [videoId]);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    return [
      {
        ...video,
        selectionReason: "direct input",
      },
    ];
  }

  const channel = resolveChannel(job.source.channelUrl);
  const lookup = await resolveChannelLookup(client, channel);

  if (!lookup.uploadsPlaylistId) {
    return [];
  }

  const playlistItems = await client.get<PlaylistItemsResponse>("/playlistItems", {
    params: {
      part: "contentDetails",
      playlistId: lookup.uploadsPlaylistId,
      maxResults: job.selection.channelCandidateLimit,
    },
  });

  const videoIds = Array.from(
    new Set((playlistItems.items ?? []).map((item) => item.contentDetails?.videoId).filter(Boolean)),
  ) as string[];

  const candidates = await fetchVideoDetails(client, videoIds);
  return filterChannelCandidates(candidates, job)
    .slice(0, job.selection.channelSelectedVideosLimit)
    .map((video) => ({
      ...video,
      selectionReason: "top by viewCount",
    }));
}

async function fetchVideoDetails(
  client: YouTubeClient,
  videoIds: string[],
): Promise<Array<SelectedVideo & FilterableVideo>> {
  if (videoIds.length === 0) {
    return [];
  }

  const response = await client.get<VideosListResponse>("/videos", {
    params: {
      part: "snippet,status,statistics,contentDetails,liveStreamingDetails",
      id: videoIds.join(","),
      maxResults: videoIds.length,
    },
  });

  return (response.items ?? [])
    .map((item): (SelectedVideo & FilterableVideo) | undefined => {
      if (!item.id || !item.snippet?.channelId || !item.contentDetails?.duration) {
        return undefined;
      }

      return {
        videoId: item.id,
        id: item.id,
        title: item.snippet.title ?? item.id,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle ?? "",
        publishedAt: item.snippet.publishedAt ?? "",
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
        videoUrl: `https://www.youtube.com/watch?v=${item.id}`,
        selectionReason: "resolved video",
        duration: item.contentDetails.duration,
        privacyStatus: item.status?.privacyStatus,
        liveBroadcastContent: item.snippet.liveBroadcastContent,
        hasLiveStreamingDetails: Boolean(item.liveStreamingDetails),
      };
    })
    .filter((item): item is SelectedVideo & FilterableVideo => item !== undefined);
}

function filterChannelCandidates(videos: Array<SelectedVideo & FilterableVideo>, job: Job): SelectedVideo[] {
  const filtered = filterChannelVideos(videos, {
    limit: job.selection.channelCandidateLimit,
    includeLive: !job.selection.excludeLive,
    includeShorts: !job.selection.excludeShorts,
  });

  return filtered.sort((left, right) => right.viewCount - left.viewCount || right.commentCount - left.commentCount);
}

function buildJobName(job: Job, video: SelectedVideo): string {
  if (job.source.type === "video") {
    return video.title || `video-${video.videoId}`;
  }

  return video.title || `channel-video-${video.videoId}`;
}

function renderCommentsMarkdown(groups: ScoredVideoArtifact[]): string {
  const lines: string[] = ["# Genius@Brains Comments", ""];

  for (const group of groups) {
    lines.push(`## ${group.title} (${group.videoId})`, "");
    for (const [index, comment] of group.comments.entries()) {
      lines.push(`${index + 1}. ${comment.author}`);
      lines.push(`   Score: ${comment.engagementScore}`);
      lines.push(`   Why: ${comment.whySelected}`);
      lines.push(`   Likes: ${comment.likeCount} | Replies: ${comment.replyCount}`);
      lines.push(`   ${comment.text}`);
      lines.push(`   ${comment.sourceUrl}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function requireApiKey(argv: string[], positionalIndex?: number): string {
  const inline = readOption(argv, "--api-key")?.trim();
  if (inline) {
    return inline;
  }

  const positional = positionalIndex === undefined ? undefined : readPositionalValue(argv, positionalIndex)?.trim();
  if (positional) {
    return positional;
  }

  const npmConfigValue = process.env.npm_config_api_key?.trim();
  if (npmConfigValue && npmConfigValue !== "true") {
    return npmConfigValue;
  }

  const value = process.env.YOUTUBE_API_KEY?.trim();
  if (!value) {
    throw new Error("YOUTUBE_API_KEY is required.");
  }

  return value;
}

function readOption(argv: string[], optionName: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === optionName) {
      return argv[index + 1];
    }

    if (token.startsWith(`${optionName}=`)) {
      return token.slice(optionName.length + 1);
    }
  }

  const envKey = `npm_config_${optionName.replace(/^--/, "").replace(/-/g, "_")}`;
  const envValue = process.env[envKey];
  return envValue && envValue !== "true" ? envValue : undefined;
}

function readPositionalValue(argv: string[], index: number): string | undefined {
  return argv.filter((token) => !token.startsWith("--"))[index];
}

function isCommentsDisabledError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "YouTubeApiError") {
    const details = (error as YouTubeApiError).details ?? [];
    return details.some((detail) => detail.reason?.toLowerCase().includes("comments"));
  }

  return /comments/i.test(error.message);
}

function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isEntrypoint(metaUrl: string, argvEntry?: string): boolean {
  if (!argvEntry) {
    return false;
  }

  return new URL(metaUrl).pathname === new URL(`file://${argvEntry.replace(/\\/g, "/")}`).pathname;
}

if (isEntrypoint(import.meta.url, process.argv[1])) {
  runCli()
    .then((message) => {
      console.log(message);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = 1;
    });
}
