import { z } from "zod";

const selectionDefaults = {
  channelCandidateLimit: 50,
  channelSelectedVideosLimit: 5,
  commentFetchLimit: 200,
  excludeLive: true,
  excludeShorts: true,
  topCommentsLimit: 100,
  topVideosLimit: 5,
  videoSort: "viewCount" as const,
};

const rankingDefaults = {
  likesWeight: 1,
  repliesWeight: 3,
};

const outputDefaults = {
  writeFlow: true,
  writeMarkdown: true,
  writeRawJson: true,
};

const selectionSchema = z
  .object({
    channelCandidateLimit: z.int().positive().default(50),
    channelSelectedVideosLimit: z.int().positive().default(5),
    commentFetchLimit: z.int().positive().default(200),
    excludeLive: z.boolean().default(true),
    excludeShorts: z.boolean().default(true),
    topCommentsLimit: z.int().positive().default(100),
    topVideosLimit: z.int().positive().default(5),
    videoSort: z.enum(["viewCount", "publishedAt"]).default("viewCount"),
  })
  .default(selectionDefaults);

const rankingSchema = z
  .object({
    likesWeight: z.number().nonnegative().default(1),
    repliesWeight: z.number().nonnegative().default(3),
  })
  .default(rankingDefaults);

const outputSchema = z
  .object({
    writeFlow: z.boolean().default(true),
    writeMarkdown: z.boolean().default(true),
    writeRawJson: z.boolean().default(true),
  })
  .default(outputDefaults);

const videoSourceSchema = z
  .object({
    type: z.literal("video"),
    videoId: z.string().min(1).optional(),
    videoUrl: z.url().optional(),
  })
  .refine((value) => Boolean(value.videoId ?? value.videoUrl), {
    message: "Video jobs require either videoUrl or videoId.",
    path: ["videoUrl"],
  });

const channelSourceSchema = z.object({
  type: z.literal("channel"),
  channelUrl: z.url(),
});

export const jobSchema = z.object({
  output: outputSchema,
  ranking: rankingSchema,
  selection: selectionSchema,
  source: z.discriminatedUnion("type", [videoSourceSchema, channelSourceSchema]),
});

export type Job = z.output<typeof jobSchema>;

export function parseJob(input: unknown): Job {
  return jobSchema.parse(input);
}
