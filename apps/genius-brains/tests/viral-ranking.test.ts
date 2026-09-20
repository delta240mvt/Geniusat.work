import {describe, expect, it} from 'vitest';

import {dedupeCandidates, rankCandidates} from '../src/viral/scoring.js';
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
    text: 'AI agents',
    mediaUrls: ['https://cdn.example/video.mp4'],
    thumbnailUrl: null,
    publishedAt: '2026-09-20T10:00:00.000Z',
    author: {username: 'creator', displayName: 'Creator'},
    metrics: {views: 1000, likes: 100, comments: 20, replies: 0, reposts: 0, shares: null},
    score: {discovery: 0, final: null, components: {}},
    evidence: {rawPayloadPath: 'raw.json', commentsPath: null},
    ...overrides,
  };
}

describe('viral candidate ranking', () => {
  it('deduplicates by platform and canonical post id while retaining distinct platforms', () => {
    const result = dedupeCandidates([
      candidate(),
      candidate({candidateId: 'instagram:1', sourceQuery: 'AI automation'}),
      candidate({candidateId: 'threads:1', platform: 'threads', contentType: 'post'}),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.candidateId)).toEqual(['instagram:1', 'threads:1']);
  });

  it('scores within platform/language/subtopic cohorts and returns deterministic order', () => {
    const ranked = rankCandidates(
      [
        candidate({
          candidateId: 'instagram:old',
          sourcePostId: 'old',
          publishedAt: '2026-09-01T10:00:00.000Z',
          metrics: {views: 100000, likes: 100, comments: 5, replies: 0, reposts: 0, shares: null},
        }),
        candidate({candidateId: 'instagram:recent', sourcePostId: 'recent'}),
      ],
      new Date('2026-09-20T12:00:00.000Z'),
    );

    expect(ranked[0].candidateId).toBe('instagram:recent');
    expect(ranked.every((item) => item.score.discovery >= 0 && item.score.discovery <= 100)).toBe(true);
    expect(Object.keys(ranked[0].score.components)).toEqual([
      'engagementVelocity',
      'commentSignal',
      'relativeViews',
      'likesReposts',
      'freshnessTopicFit',
    ]);
  });
});
