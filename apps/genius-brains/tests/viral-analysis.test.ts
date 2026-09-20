import {describe, expect, it} from 'vitest';

import {buildAnalysisPack, isTranscriptEligible, parseCodexAnalysisDocument} from '../src/viral/analysis.js';
import type {ViralCandidate} from '../src/viral/types.js';

function candidate(overrides: Partial<ViralCandidate> = {}): ViralCandidate {
  return {
    candidateId: 'instagram:1',
    runId: 'run-1',
    platform: 'instagram',
    language: 'en',
    subtopic: 'AI agents',
    sourceQuery: 'AI agents',
    sourcePostId: '1',
    sourceUrl: 'https://instagram.com/reel/1',
    contentType: 'reel',
    text: 'Build AI agents',
    mediaUrls: ['https://cdn.example/video.mp4'],
    thumbnailUrl: null,
    publishedAt: '2026-09-20T10:00:00.000Z',
    author: {username: 'creator', displayName: 'Creator'},
    metrics: {views: 1000, likes: 100, comments: 20, replies: 0, reposts: 0, shares: null},
    score: {discovery: 80, final: null, components: {}},
    evidence: {rawPayloadPath: 'run-1/raw.json', commentsPath: 'run-1/comments.json'},
    ...overrides,
  };
}

describe('viral analysis contract', () => {
  it('transcribes Instagram reels and Threads videos, but skips text-only Threads', () => {
    expect(isTranscriptEligible(candidate())).toBe(true);
    expect(isTranscriptEligible(candidate({platform: 'threads', contentType: 'video'}))).toBe(true);
    expect(isTranscriptEligible(candidate({platform: 'threads', contentType: 'post', mediaUrls: []}))).toBe(false);
  });

  it('builds a bounded analysis pack with evidence references', () => {
    const pack = buildAnalysisPack({
      runId: 'run-1',
      candidates: [candidate()],
      commentsByCandidate: {
        'instagram:1': [{id: 'comment-1', text: 'This is useful', author: 'viewer', likes: 4}],
      },
      transcriptsByCandidate: {},
    });

    expect(pack.items[0]).toMatchObject({
      candidateId: 'instagram:1',
      sourceUrl: 'https://instagram.com/reel/1',
      comments: [{id: 'comment-1', text: 'This is useful'}],
    });
  });

  it('validates Codex output and rejects unsupported visual claims', () => {
    const document = parseCodexAnalysisDocument({
      schemaVersion: '1.0',
      runId: 'run-1',
      items: [
        {
          candidateId: 'instagram:1',
          summary: 'A practical AI agents tip.',
          topic: 'AI agents',
          hook: 'A direct promise.',
          structure: ['promise', 'explanation', 'payoff'],
          viralMechanisms: [{label: 'specificity', evidenceRefs: ['transcript:1']}],
          commentThemes: [{label: 'interest', evidenceRefs: ['comment:comment-1']}],
          transcriptInsights: ['The transcript gives a concrete workflow.'],
          adaptationIdeas: ['Use a concrete before/after hook.'],
          risks: [],
          uncertainties: [],
          confidence: 0.8,
          evidenceRefs: ['instagram:1', 'transcript:1'],
        },
      ],
      synthesis: {
        recurringTopics: ['AI agents'],
        recurringHooks: ['specific promise'],
        recurringStructures: ['promise → explanation → payoff'],
        commentPatterns: ['viewers ask for implementation details'],
        platformDifferences: [],
        recommendations: ['Lead with a concrete result.'],
        evidenceRefs: ['instagram:1'],
      },
    });

    expect(document.items).toHaveLength(1);
    expect(() => parseCodexAnalysisDocument({schemaVersion: '1.0', runId: 'run-1', items: [], synthesis: {}})).toThrow();
  });
});
