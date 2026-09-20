import {describe, expect, it} from 'vitest';

import {parseViralIntelligenceConfig} from '../src/viral/config.js';
import {BudgetLedger, BudgetExceededError} from '../src/viral/budget.js';
import {ViralBrainsRepository} from '../src/viral/persistence.js';

describe('viral intelligence contracts', () => {
  it('validates the four discovery variants and the 100-credit allocation', () => {
    const config = parseViralIntelligenceConfig({
      niche: 'AI',
      subtopics: ['AI agents'],
      queries: {
        instagram: {en: ['AI agents'], pl: ['agenci AI']},
        threads: {en: ['AI agents'], pl: ['agenci AI']},
      },
    });

    expect(config.budget.maxCredits).toBe(100);
    expect(config.queries.instagram.en[0]).toBe('AI agents');
    expect(config.queries.threads.pl[0]).toBe('agenci AI');
  });

  it('rejects a budget that does not sum to the hard cap', () => {
    expect(() =>
      parseViralIntelligenceConfig({
        niche: 'AI',
        subtopics: ['AI agents'],
        queries: {
          instagram: {en: ['AI agents'], pl: ['agenci AI']},
          threads: {en: ['AI agents'], pl: ['agenci AI']},
        },
        budget: {
          maxCredits: 100,
          discoveryCredits: 20,
          instagramCommentsCredits: 50,
          threadsEnrichmentCredits: 10,
          reserveCredits: 10,
        },
      }),
    ).toThrow(/sum to maxCredits/);
  });

  it('charges and hard-stops before an unaffordable call', () => {
    const ledger = new BudgetLedger(10);

    ledger.reserve('discovery', 4);
    ledger.commit('discovery', 3);

    expect(ledger.remaining()).toBe(7);
    expect(() => ledger.reserve('comments', 8)).toThrow(BudgetExceededError);
    expect(ledger.snapshot().spentCredits).toBe(3);
  });

  it('does not spend into another reservation when provider usage exceeds its estimate', () => {
    const ledger = new BudgetLedger(10);
    ledger.reserve('safety', 2);
    ledger.reserve('call', 1);
    expect(() => ledger.commit('call', 9)).toThrow(BudgetExceededError);
    expect(ledger.snapshot().spentCredits).toBe(0);
  });

  it('persists a run and candidate in SQLite', () => {
    const repository = ViralBrainsRepository.inMemory();
    repository.createRun({runId: 'run-1', configHash: 'hash-1'});
    repository.insertCandidate({
      candidateId: 'instagram:1',
      runId: 'run-1',
      platform: 'instagram',
      language: 'en',
      subtopic: 'AI agents',
      sourceQuery: 'AI agents',
      sourcePostId: '1',
      sourceUrl: 'https://instagram.com/reel/1',
      contentType: 'reel',
      text: 'Build with AI',
      mediaUrls: [],
      thumbnailUrl: null,
      publishedAt: '2026-09-20T10:00:00.000Z',
      author: {username: 'creator', displayName: 'Creator'},
      metrics: {views: 10, likes: 2, comments: 1, replies: 0, reposts: 0, shares: null},
      score: {discovery: 75, final: null, components: {freshness: 0.8}},
      evidence: {rawPayloadPath: 'runs/run-1/raw.json', commentsPath: null},
    });

    expect(repository.listCandidates('run-1')).toHaveLength(1);
    expect(repository.getRun('run-1')?.status).toBe('planned');
  });
});
