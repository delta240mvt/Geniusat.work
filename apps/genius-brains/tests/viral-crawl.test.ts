import {mkdtemp, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {parseViralIntelligenceConfig} from '../src/viral/config.js';
import {runViralCrawl, type CrawlClient} from '../src/viral/crawl.js';
import {ViralBrainsRepository} from '../src/viral/persistence.js';
import type {SocialCrawlEnvelope} from '../src/viral/socialcrawl.js';

function config() {
  return parseViralIntelligenceConfig({
    niche: 'AI',
    subtopics: ['AI agents'],
    queries: {
      instagram: {en: ['AI agents'], pl: ['agenci AI']},
      threads: {en: ['AI agents'], pl: ['agenci AI']},
    },
  });
}

function post(platform: 'instagram' | 'threads', id: string, url: string) {
  return {
    data: {
      items: [
        {
          post: {
            id,
            url,
            content: {text: `${platform} ${id}`, media_urls: platform === 'instagram' ? [`https://cdn/${id}.mp4`] : []},
            author: {username: 'creator', display_name: 'Creator'},
            engagement: {views: 10000, likes: 500, comments: 40, reposts: 10},
            published_at: '2026-09-20T10:00:00.000Z',
          },
        },
      ],
    },
    credits_used: 1,
    request_id: `${platform}-${id}`,
    pagination: {has_more: false},
  } satisfies SocialCrawlEnvelope;
}

function fakeClient(): CrawlClient {
  return {
    searchInstagramReels: async (query) => post('instagram', query === 'AI agents' ? 'ig-en' : 'ig-pl', `https://instagram.com/reel/${query}`),
    searchThreads: async (query) => post('threads', query === 'AI agents' ? 'th-en' : 'th-pl', `https://threads.net/post/${query}`),
    getInstagramComments: async () => ({data: {items: []}, credits_used: 5}),
    getThreadsPost: async () => ({data: {items: []}, credits_used: 1}),
    getThreadsComments: async () => ({data: {items: []}, credits_used: 1}),
  };
}

describe('viral crawl runner', () => {
  it('runs four variants, ranks locally, enriches selected candidates and writes raw evidence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'genius-brains-crawl-'));
    const repository = ViralBrainsRepository.inMemory();

    const result = await runViralCrawl({
      config: config(),
      client: fakeClient(),
      repository,
      dataRoot: root,
      now: new Date('2026-09-20T12:00:00.000Z'),
      runId: 'run-test',
    });

    expect(result.run.status).toBe('complete');
    expect(result.candidates).toHaveLength(4);
    expect(result.selectedCandidates).toHaveLength(4);
    expect(result.budget.spentCredits).toBe(18);
    expect(repository.listRuns()[0].analysisStatus).toBe('pending');
    expect(await readFile(path.join(root, 'run-test', 'raw', 'instagram-en-1.json'), 'utf8')).toContain('ig-en');
  });

  it('continues as a partial run when one discovery variant fails', async () => {
    const client = fakeClient();
    const failingClient: CrawlClient = {
      ...client,
      searchThreads: async (query) => {
        if (query === 'agenci AI') throw new Error('Threads PL unavailable');
        return client.searchThreads(query);
      },
    };
    const repository = ViralBrainsRepository.inMemory();
    const root = await mkdtemp(path.join(os.tmpdir(), 'genius-brains-crawl-'));

    const result = await runViralCrawl({
      config: config(),
      client: failingClient,
      repository,
      dataRoot: root,
      now: new Date('2026-09-20T12:00:00.000Z'),
      runId: 'run-partial',
    });

    expect(result.run.status).toBe('partial');
    expect(result.candidates).toHaveLength(3);
    expect(result.errors).toContain('threads/pl:agenci AI: Threads PL unavailable');
  });
});
