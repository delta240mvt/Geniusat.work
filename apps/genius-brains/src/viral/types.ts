export type ViralPlatform = 'instagram' | 'threads';
export type ViralLanguage = 'en' | 'pl';
export type ViralVariant = `${ViralPlatform}/${ViralLanguage}`;

export interface ViralQuerySet {
  instagram: Record<ViralLanguage, string[]>;
  threads: Record<ViralLanguage, string[]>;
}

export interface ViralBudgetConfig {
  maxCredits: 100;
  discoveryCredits: number;
  instagramCommentsCredits: number;
  threadsEnrichmentCredits: number;
  reserveCredits: number;
}

export interface ViralIntelligenceConfig {
  niche: string;
  subtopics: string[];
  queries: ViralQuerySet;
  lookbackDays: number;
  budget: ViralBudgetConfig;
}

export interface CandidateMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  replies: number | null;
  reposts: number | null;
  shares: number | null;
}

export interface CandidateAuthor {
  username: string | null;
  displayName: string | null;
}

export interface CandidateScore {
  discovery: number;
  final: number | null;
  components: Record<string, number>;
}

export interface CandidateEvidence {
  rawPayloadPath: string;
  commentsPath: string | null;
}

export interface ViralCandidate {
  candidateId: string;
  runId: string;
  platform: ViralPlatform;
  language: ViralLanguage;
  subtopic: string;
  sourceQuery: string;
  sourcePostId: string;
  sourceUrl: string;
  contentType: 'reel' | 'post' | 'video';
  text: string | null;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  publishedAt: string | null;
  author: CandidateAuthor;
  metrics: CandidateMetrics;
  score: CandidateScore;
  evidence: CandidateEvidence;
}

export type CrawlStatus = 'planned' | 'running' | 'complete' | 'partial' | 'failed';
export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'partial' | 'failed';

export interface ViralRun {
  runId: string;
  status: CrawlStatus;
  analysisStatus: AnalysisStatus;
  startedAt: string | null;
  finishedAt: string | null;
  configHash: string;
  spentCredits: number;
  reservedCredits: number;
  errorSummary: string | null;
}
