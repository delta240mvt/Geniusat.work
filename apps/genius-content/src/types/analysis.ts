import {z} from 'zod';

export const projectConfigSchema = z.object({
  videoIntelligence: z.object({
    enabled: z.boolean(),
    locationId: z.string().optional(),
    features: z.array(z.string()).min(1),
    speechTranscriptionConfig: z.object({
      languageCode: z.string(),
      enableAutomaticPunctuation: z.boolean(),
      filterProfanity: z.boolean(),
      maxAlternatives: z.number().int().min(1).max(30),
    }),
    faceDetectionConfig: z.object({
      includeBoundingBoxes: z.boolean(),
      includeAttributes: z.boolean(),
    }),
  }),
  firecrawl: z.object({
    enabled: z.boolean(),
    maxSources: z.number().int().positive(),
  }),
  speechTranscription: z.object({
    enabled: z.boolean(),
  }),
  textDetection: z.object({
    enabled: z.boolean(),
  }),
  storyboard: z.object({
    maxCaptionChars: z.number().int().positive(),
    maxHookChars: z.number().int().positive(),
    maxBullets: z.number().int().positive(),
    shorteningMode: z.enum(['aggressive', 'balanced']),
  }),
  layout: z.object({
    preset: z.string(),
    topRatio: z.number().positive().max(0.9),
  }),
  style: z.object({
    animation: z.string(),
    typography: z.string(),
  }),
  fallbacks: z.object({
    continueWithoutFirecrawl: z.boolean(),
    allowMinimalStoryboardOnPartialAnnotations: z.boolean(),
    stopRenderOnGoogleFailure: z.boolean(),
  }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    codec: z.enum(['h264']),
  }),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export const sourceRefSchema = z.object({
  kind: z.enum(['video', 'research']),
  value: z.string(),
});

export type SourceRef = z.infer<typeof sourceRefSchema>;

export const storyboardSceneSchema = z.object({
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  kicker: z.string().optional(),
  hookText: z.string(),
  caption: z.string(),
  supportingBullets: z.array(z.string()),
  visualType: z.enum(['headline', 'timeline', 'keywords', 'stat', 'quote']),
  layout: z.object({
    preset: z.string(),
  }),
  sourceRefs: z.array(sourceRefSchema),
});

export type StoryboardScene = z.infer<typeof storyboardSceneSchema>;

export const normalizedAnalysisSchema = z.object({
  sourceVideo: z.string(),
  videoId: z.string(),
  durationMs: z.number().nonnegative(),
  shots: z.array(
    z.object({
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
    }),
  ),
  labels: z.array(
    z.object({
      description: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  objects: z.array(
    z.object({
      name: z.string(),
      confidence: z.number().min(0).max(1),
      startMs: z.number().nonnegative().optional(),
      endMs: z.number().nonnegative().optional(),
    }),
  ),
  textDetections: z.array(z.string()),
  speech: z.array(
    z.object({
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
      text: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      words: z.array(
        z.object({
          startMs: z.number().nonnegative(),
          endMs: z.number().nonnegative(),
          word: z.string(),
        }),
      ),
    }),
  ),
  faceDetections: z.array(
    z.object({
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
      attributes: z.array(z.string()),
    }),
  ),
  research: z.array(
    z.object({
      title: z.string(),
      snippet: z.string(),
      sourceUrl: z.string().optional(),
      domain: z.string().optional(),
      imageUrl: z.string().optional(),
      imageAssetPath: z.string().optional(),
      logoUrl: z.string().optional(),
      logoAssetPath: z.string().optional(),
      highlights: z.array(z.string()).optional(),
      proofTextSnippets: z.array(z.string()).optional(),
      markdownPath: z.string().optional(),
      htmlPath: z.string().optional(),
      imageCandidates: z
        .array(
          z.object({
            url: z.string(),
            assetPath: z.string().optional(),
            score: z.number(),
            kind: z.enum(['logo', 'image', 'screenshot', 'page-capture']),
            source: z.enum(['html', 'markdown', 'meta', 'screenshot']),
          }),
        )
        .optional(),
      logoCandidates: z
        .array(
          z.object({
            url: z.string(),
            assetPath: z.string().optional(),
            score: z.number(),
            kind: z.enum(['logo', 'image', 'screenshot', 'page-capture']),
            source: z.enum(['html', 'markdown', 'meta', 'screenshot']),
          }),
        )
        .optional(),
      screenshotCandidates: z
        .array(
          z.object({
            url: z.string(),
            assetPath: z.string().optional(),
            score: z.number(),
            kind: z.enum(['logo', 'image', 'screenshot', 'page-capture']),
            source: z.enum(['html', 'markdown', 'meta', 'screenshot']),
          }),
        )
        .optional(),
      pageCaptures: z
        .array(
          z.object({
            url: z.string(),
            assetPath: z.string().optional(),
            score: z.number(),
            kind: z.enum(['logo', 'image', 'screenshot', 'page-capture']),
            source: z.enum(['html', 'markdown', 'meta', 'screenshot']),
          }),
        )
        .optional(),
    }),
  ),
  storyboard: z.array(storyboardSceneSchema),
  diagnostics: z.object({
    googleRawPath: z.string().nullable(),
    firecrawlRawPath: z.string().nullable(),
    whisperRawPath: z.string().nullable(),
    errors: z.array(z.string()),
  }),
});

export type NormalizedAnalysis = z.infer<typeof normalizedAnalysisSchema>;

export const pipelineResultSchema = z.object({
  analysis: normalizedAnalysisSchema,
  analysisPath: z.string(),
  choreographyPath: z.string(),
  renderPath: z.string(),
  stagedVideoPath: z.string(),
});

export type PipelineResult = z.infer<typeof pipelineResultSchema>;

export const createEmptyAnalysisDocument = (
  sourceVideo: string,
  videoId: string,
  durationMs: number,
): NormalizedAnalysis => ({
  sourceVideo,
  videoId,
  durationMs,
  shots: [],
  labels: [],
  objects: [],
  textDetections: [],
  speech: [],
  faceDetections: [],
  research: [],
  storyboard: [],
  diagnostics: {
    googleRawPath: null,
    firecrawlRawPath: null,
    whisperRawPath: null,
    errors: [],
  },
});
