import {z} from 'zod';

import type {ViralCandidate} from './types.js';

export interface AnalysisPackComment {
  id: string;
  text: string;
  author: string | null;
  likes: number | null;
}

export interface AnalysisPackTranscript {
  text: string;
  language: string | null;
  confidence: number | null;
  artifactPath: string | null;
}

export interface AnalysisPackItem {
  candidateId: string;
  platform: ViralCandidate['platform'];
  language: ViralCandidate['language'];
  sourceUrl: string;
  text: string | null;
  metrics: ViralCandidate['metrics'];
  score: ViralCandidate['score'];
  transcript: AnalysisPackTranscript | null;
  comments: AnalysisPackComment[];
  evidenceRefs: string[];
}

export interface AnalysisPack {
  schemaVersion: '1.0';
  runId: string;
  generatedAt: string;
  items: AnalysisPackItem[];
}

const evidenceRefSchema = z.string().min(1);

const analysisItemSchema = z.object({
  candidateId: z.string().min(1),
  summary: z.string().min(1),
  topic: z.string().min(1),
  hook: z.string().min(1),
  structure: z.array(z.string().min(1)).min(1),
  viralMechanisms: z.array(z.object({label: z.string().min(1), evidenceRefs: z.array(evidenceRefSchema).min(1)})).min(1),
  commentThemes: z.array(z.object({label: z.string().min(1), evidenceRefs: z.array(evidenceRefSchema).min(1)})).min(1),
  transcriptInsights: z.array(z.string().min(1)),
  adaptationIdeas: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string().min(1)),
  uncertainties: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(evidenceRefSchema).min(1),
});

const synthesisSchema = z.object({
  recurringTopics: z.array(z.string().min(1)).min(1),
  recurringHooks: z.array(z.string().min(1)).min(1),
  recurringStructures: z.array(z.string().min(1)).min(1),
  commentPatterns: z.array(z.string().min(1)).min(1),
  platformDifferences: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1)).min(1),
  evidenceRefs: z.array(evidenceRefSchema).min(1),
});

const codexAnalysisSchema = z.object({
  schemaVersion: z.literal('1.0'),
  runId: z.string().min(1),
  items: z.array(analysisItemSchema).min(1),
  synthesis: synthesisSchema,
});

export type CodexAnalysisDocument = z.infer<typeof codexAnalysisSchema>;

export function isTranscriptEligible(candidate: ViralCandidate): boolean {
  if (candidate.mediaUrls.length === 0) return false;
  return candidate.platform === 'instagram' || candidate.contentType === 'video';
}

export function buildAnalysisPack(input: {
  runId: string;
  candidates: ViralCandidate[];
  commentsByCandidate: Record<string, AnalysisPackComment[]>;
  transcriptsByCandidate: Record<string, AnalysisPackTranscript>;
}): AnalysisPack {
  return {
    schemaVersion: '1.0',
    runId: input.runId,
    generatedAt: new Date().toISOString(),
    items: input.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      platform: candidate.platform,
      language: candidate.language,
      sourceUrl: candidate.sourceUrl,
      text: candidate.text,
      metrics: candidate.metrics,
      score: candidate.score,
      transcript: input.transcriptsByCandidate[candidate.candidateId] ?? null,
      comments: input.commentsByCandidate[candidate.candidateId] ?? [],
      evidenceRefs: [candidate.candidateId, candidate.evidence.rawPayloadPath, ...(candidate.evidence.commentsPath ? [candidate.evidence.commentsPath] : [])],
    })),
  };
}

export function parseCodexAnalysisDocument(input: unknown): CodexAnalysisDocument {
  return codexAnalysisSchema.parse(input);
}

export function createAnalysisPrompt(pack: AnalysisPack): string {
  return [
    '# Genius@Brains Codex analysis',
    '',
    'Analyze every item from the JSON pack. Use only its text, transcript, metrics and comments as evidence.',
    'Return JSON matching the Codex analysis schemaVersion 1.0.',
    'Do not infer visual details that are not present in the evidence.',
    'Every mechanism, theme and recommendation must reference one or more evidenceRefs.',
    '',
    `Run: ${pack.runId}`,
    `Items: ${pack.items.length}`,
    '',
    'Required output sections: items, then synthesis.',
  ].join('\n');
}
