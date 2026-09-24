export interface CanvasConfigInput {
  workspaceRoot?: string;
  packageRoot?: string;
  publicRoot?: string;
  analysisRoot?: string;
  videoRoot?: string;
  scaleCalendarPath?: string;
  geniusBrainsDataRoot?: string;
  port?: number;
}

export interface CanvasConfig {
  workspaceRoot: string;
  packageRoot: string;
  publicRoot: string;
  analysisRoot: string;
  videoRoot: string;
  scaleCalendarPath: string;
  geniusBrainsDataRoot: string;
  port: number;
}

export interface ViralBrainsDashboard {
  generatedAt: string;
  runs: Array<{
    id: string;
    status: string;
    analysisStatus: string;
    startedAt: string | null;
    finishedAt: string | null;
    spentCredits: number;
    errorSummary: string | null;
    researchCriteria: Record<string, unknown> | null;
  }>;
  candidates: Array<{
    id: string;
    runId: string;
    platform: string;
    language: string;
    subtopic: string;
    sourceQuery: string;
    sourceUrl: string;
    contentType: string;
    text: string | null;
    publishedAt: string | null;
    metrics: Record<string, number | null>;
    discoveryScore: number;
    finalScore: number | null;
    scoreComponents: Record<string, number>;
    enrichmentStatus: string;
    comments: Array<{id: string; author: string | null; text: string; likes: number | null}>;
    transcript: {text: string; language: string | null; confidence: number | null} | null;
    analysis: Record<string, unknown> | null;
  }>;
  reports: Array<{runId: string; type: string; markdownPath: string; jsonPath: string; document: Record<string, unknown> | null}>;
}

export interface AnalysisListEntry {
  name: string;
  updatedAt: number;
}

export interface StoryboardScene {
  startMs: number;
  endMs: number;
  hookText: string;
  caption: string;
  supportingBullets: string[];
  visualType: string;
}

export interface RenderAnalysis {
  videoId: string;
  durationMs: number;
  sourceVideo?: string;
  storyboard: StoryboardScene[];
}

export interface ScaleCalendarRunSummary {
  itemId: string;
  type: 'validation' | 'dry_run' | 'publish';
  status: 'ok' | 'blocked' | 'failed';
  message?: string;
  artifactPath?: string;
  createdAt: string;
}

export interface ScaleCalendarAsset {
  id: string;
  type: string;
  localPath?: string;
  publicUrl?: string;
  altText?: string;
}

export interface ScaleCalendarEntry {
  id: string;
  projectId: string;
  projectName: string;
  platforms: string[];
  scheduledAt: string;
  timezone: string;
  status: string;
  title: string;
  bodyPreview: string;
  source: Record<string, unknown>;
  assets: ScaleCalendarAsset[];
  latestRun?: ScaleCalendarRunSummary;
}

export interface ScaleCalendar {
  generatedAt: string | null;
  entries: ScaleCalendarEntry[];
}

export interface CanvasPreviewNode {
  id: string;
  label: string;
  app: 'content' | 'brains' | 'scale';
  type: string;
  status: string;
  summary: string;
  sourcePath?: string;
  outputPath?: string;
  metadata?: Record<string, unknown>;
}

export interface CanvasPromptPreview {
  id: string;
  title: string;
  kind: string;
  path: string;
  bodyPreview: string;
  metadata?: Record<string, unknown>;
}

export interface CanvasAssetPreview {
  id: string;
  name: string;
  type: string;
  path: string;
  sizeBytes?: number;
  updatedAt?: number;
  publicUrl?: string;
  altText?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentRunPreview {
  id: string;
  title: string;
  status: string;
  workspaceKind: 'ai-studio' | 'reels';
  workspaceLabel: string;
  updatedAt: number;
  rootPath: string;
  nodes: CanvasPreviewNode[];
  prompts: CanvasPromptPreview[];
  artifacts: CanvasAssetPreview[];
}

export interface BrainsVideoPreview {
  videoId?: string;
  title: string;
  viewCount?: number;
  commentCount?: number;
  status?: string;
}

export interface BrainsCommentPreview {
  author?: string;
  text: string;
  engagementScore?: number;
  likeCount?: number;
  replyCount?: number;
  sourceUrl?: string;
  whySelected?: string;
}

export interface BrainsRunPreview {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
  rootPath: string;
  videos: BrainsVideoPreview[];
  comments: BrainsCommentPreview[];
  artifacts: CanvasAssetPreview[];
}

export interface CanvasAssetLibrary {
  generatedAt: string;
  assets: CanvasAssetPreview[];
}
