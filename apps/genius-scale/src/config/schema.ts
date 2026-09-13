import {z} from 'zod';

export const ContentStatusSchema = z.enum([
  'draft',
  'scheduled',
  'ready',
  'validation_failed',
  'dry_run_ok',
  'publish_blocked',
  'publish_pending',
  'published',
  'failed',
]);

export const ContentSourceSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('manual'),
      path: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('genius-content'),
      artifactPath: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('genius-brains'),
      artifactPath: z.string().min(1),
    })
    .strict(),
]);

export const ContentHistoryEventSchema = z
  .object({
    type: z.enum(['prepare', 'validation', 'dry_run', 'publish']),
    status: z.enum(['ok', 'blocked', 'failed']),
    message: z.string().min(1).optional(),
    artifactPath: z.string().min(1).optional(),
    createdAt: z.string().datetime({offset: true}),
  })
  .strict();

export const ContentAssetSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['image', 'video']),
    localPath: z.string().min(1).optional(),
    publicUrl: z.string().url().optional(),
    altText: z.string().min(1).optional(),
  })
  .strict();

export const ThreadsPublishOptionsSchema = z
  .object({
    postType: z.enum(['text', 'image', 'video', 'carousel']),
    replyControl: z.enum(['everyone', 'followers', 'mentioned_only']).optional(),
    replyToId: z.string().min(1).optional(),
    topicTag: z.string().min(1).optional(),
  })
  .strict();

export const ContentItemSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().min(1),
    body: z.string(),
    scheduledAt: z.string().datetime({offset: true}),
    status: ContentStatusSchema,
    source: ContentSourceSchema,
    assets: z.array(ContentAssetSchema),
    platforms: z
      .object({
        threads: ThreadsPublishOptionsSchema.optional(),
      })
      .strict(),
    history: z.array(ContentHistoryEventSchema),
  })
  .strict();

export const ProjectConfigSchema = z
  .object({
    projectId: z.string().min(1),
    name: z.string().min(1),
    timezone: z.string().min(1),
    platforms: z
      .object({
        threads: z
          .object({
            threadsUserId: z.string().min(1).optional(),
            accessTokenEnv: z.string().min(1).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export const CalendarRunSummarySchema = z
  .object({
    itemId: z.string().min(1),
    type: z.enum(['validation', 'dry_run', 'publish']),
    status: z.enum(['ok', 'blocked', 'failed']),
    message: z.string().min(1).optional(),
    artifactPath: z.string().min(1).optional(),
    createdAt: z.string().datetime({offset: true}),
  })
  .strict();

export const ScaleCalendarEntrySchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    platforms: z.array(z.literal('threads')),
    scheduledAt: z.string().datetime({offset: true}),
    timezone: z.string().min(1),
    status: ContentStatusSchema,
    title: z.string().min(1),
    bodyPreview: z.string(),
    source: ContentSourceSchema,
    assets: z.array(ContentAssetSchema.pick({id: true, type: true, localPath: true, publicUrl: true, altText: true})),
    latestRun: CalendarRunSummarySchema.optional(),
  })
  .strict();

export const ScaleCalendarSchema = z
  .object({
    generatedAt: z.string().datetime({offset: true}),
    entries: z.array(ScaleCalendarEntrySchema),
  })
  .strict();

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type ContentSource = z.infer<typeof ContentSourceSchema>;
export type ContentHistoryEvent = z.infer<typeof ContentHistoryEventSchema>;
export type ContentAsset = z.infer<typeof ContentAssetSchema>;
export type ThreadsPublishOptions = z.infer<typeof ThreadsPublishOptionsSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type CalendarRunSummary = z.infer<typeof CalendarRunSummarySchema>;
export type ScaleCalendarEntry = z.infer<typeof ScaleCalendarEntrySchema>;
export type ScaleCalendar = z.infer<typeof ScaleCalendarSchema>;

export const parseContentItem = (value: unknown): ContentItem => ContentItemSchema.parse(value);
export const parseProjectConfig = (value: unknown): ProjectConfig => ProjectConfigSchema.parse(value);
export const parseScaleCalendar = (value: unknown): ScaleCalendar => ScaleCalendarSchema.parse(value);
