import type {ResearchItem} from '../lib/firecrawl.js';

export type TranscriptTopic = {
  id: string;
  label: string;
  emphasis: string;
  segmentIndex: number;
  startMs: number;
  endMs: number;
  transcriptText: string;
  keywords: string[];
};

export type TranscriptBrief = {
  videoId: string;
  summary: string;
  primaryTopics: TranscriptTopic[];
  spokenLanguage: string;
  pacing: 'measured' | 'fast';
};

export type ResearchPlan = {
  videoId: string;
  queries: string[];
  preferredDomains: string[];
  seedUrls: Array<{
    topicId: string;
    url: string;
  }>;
  assetGoals: Array<{
    topicId: string;
    need: 'logo' | 'image' | 'knowledge';
    rationale: string;
  }>;
};

export type EvidenceNeed = {
  topicId: string;
  sceneLabel: string;
  sceneIntent: string;
  visualStory: string;
  requiredProof: Array<'logo' | 'hero-shot' | 'product-ui' | 'screenshot' | 'facts' | 'comparison'>;
  desiredShotTypes: Array<'brand-card' | 'image-focus' | 'proof-card' | 'comparison-card'>;
  searchQueries: string[];
  preferredDomains: string[];
  seedUrls: string[];
};

export type EvidencePlan = {
  videoId: string;
  createdAt: string;
  strategy: string;
  topics: EvidenceNeed[];
};

export type AssetAnalysisItem = {
  topicId: string;
  chosenSource?: ResearchItem;
  score: number;
  reasons: string[];
};

export type AssetAnalysis = {
  videoId: string;
  evaluatedAt: string;
  items: AssetAnalysisItem[];
};

export type EvidenceShot = {
  id: string;
  startMs: number;
  endMs: number;
  type: 'chapter-card' | 'brand-card' | 'image-focus' | 'proof-card' | 'comparison-card';
  motion: 'hard-cut' | 'push-in' | 'slide-up' | 'slide-left' | 'crop-pan' | 'stack-swap' | 'hold';
  title?: string;
  body?: string;
  bullets?: string[];
  assetPath?: string;
  logoAssetPath?: string;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
    zoomFrom?: number;
    zoomTo?: number;
  };
  referenceReason?: string;
};

export type ChoreographyScene = {
  id: string;
  startMs: number;
  endMs: number;
  topTemplate: 'comparison-opener' | 'command-board' | 'editorial-spotlight' | 'research-board';
  kicker: string;
  hookText: string;
  caption: string;
  supportingBullets: string[];
  transcriptText: string;
  transcriptWords: Array<{
    startMs: number;
    endMs: number;
    word: string;
  }>;
  palette: {
    primary: string;
    secondary: string;
    panel: string;
  };
  motion: {
    headline: 'lift' | 'slide' | 'pulse';
    asset: 'float' | 'stack' | 'spotlight';
    captions: 'word-by-word';
  };
  asset?: {
    title: string;
    sourceUrl?: string;
    domain?: string;
    imageAssetPath?: string;
    logoAssetPath?: string;
    highlights?: string[];
    proofTextSnippets?: string[];
    markdownPath?: string;
    htmlPath?: string;
    imageCandidates?: ResearchItem['imageCandidates'];
    logoCandidates?: ResearchItem['logoCandidates'];
    screenshotCandidates?: ResearchItem['screenshotCandidates'];
    pageCaptures?: ResearchItem['pageCaptures'];
  };
  googleSignals: {
    labels: string[];
    objects: string[];
    faceAttributes: string[];
  };
  bottomLayer: EvidenceShot[];
};

export type ChoreographyDocument = {
  videoId: string;
  createdAt: string;
  strategy: string;
  transcriptSummary: string;
  referenceStyleSources: string[];
  scenes: ChoreographyScene[];
};
