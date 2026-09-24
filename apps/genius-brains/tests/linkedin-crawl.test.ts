import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {prepareAnalysisPack} from '../src/viral/analysis-runner.js';
import {parseLinkedInCrawlConfig} from '../src/viral/linkedin-config.js';
import {runLinkedInCrawl, type LinkedInCrawlClient} from '../src/viral/linkedin-crawl.js';
import {ViralBrainsRepository} from '../src/viral/persistence.js';
import {SocialCrawlClient, SocialCrawlError} from '../src/viral/socialcrawl.js';

const now = new Date('2026-09-23T10:00:00.000Z');

function post(id: string, likes: number) {
  return {post: {
    id, url: `https://www.linkedin.com/posts/example_${id}`,
    description: `AI agents pattern ${id}`, published_at: '2026-09-22T10:00:00.000Z',
    author: {name: 'Creator'}, engagement: {reactions: likes, comments: 12},
  }};
}

describe('LinkedIn research crawl', () => {
  it('validates AI-supplied searches and the separate 100-credit budget', () => {
    expect(() => parseLinkedInCrawlConfig({analysisFocus: 'AI patterns', searches: [{}]})).toThrow(/query or LinkedIn source id/);
    expect(() => parseLinkedInCrawlConfig({analysisFocus: 'AI patterns', searches: [{query: 'AI'}], budget: {searchCredits: 90}})).toThrow(/sum to 100/);
    expect(parseLinkedInCrawlConfig({analysisFocus: 'AI patterns', searches: [{query: 'AI'}]}).budget.maxCredits).toBe(100);
  });

  it('uses documented search filters without requesting metered labels or bulk limits', async () => {
    const urls: URL[] = [];
    const client = new SocialCrawlClient({apiKey: 'test', fetchImpl: async (input) => {
      urls.push(new URL(String(input)));
      return Response.json({success: true, data: {items: []}, credits_used: 5, pagination: {has_more: false}});
    }});
    const search = parseLinkedInCrawlConfig({analysisFocus: 'AI', searches: [{query: 'AI agents', language: 'pl', datePosted: 'past_week', contentType: 'documents', fromCompanyId: '1035'}]}).searches[0];
    await client.searchLinkedInPosts(search, 2);
    await client.getLinkedInComments('https://www.linkedin.com/posts/example_1');
    await client.getLinkedInComments('https://www.linkedin.com/pulse/example-article/');
    expect(urls[0].pathname).toBe('/v1/linkedin/search/posts');
    expect(urls[0].searchParams.get('date_posted')).toBe('past_week');
    expect(urls[0].searchParams.get('content_type')).toBe('documents');
    expect(urls[0].searchParams.get('from_company')).toBe('1035');
    expect(urls[0].searchParams.get('relevance')).toBe('filter');
    expect(urls[0].searchParams.get('page')).toBe('2');
    expect(urls[0].searchParams.has('limit')).toBe(false);
    expect(urls[0].searchParams.has('label')).toBe(false);
    expect(urls[1].pathname).toBe('/v1/linkedin/post/comments');
    expect(urls[1].searchParams.get('sort_order')).toBe('relevance');
    expect(urls[2].pathname).toBe('/v1/linkedin/article/comments');
    expect(urls[2].searchParams.has('sort_order')).toBe(false);
  });

  it('filters and deduplicates posts, enriches selected comments and passes criteria to Codex', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brains-linkedin-'));
    const repository = ViralBrainsRepository.inMemory();
    const config = parseLinkedInCrawlConfig({
      analysisFocus: 'Find concrete AI-agent case-study structures and audience objections',
      searches: [{query: 'AI agents', language: 'en', maxPages: 2}],
      filters: {minLikes: 50, anyKeywords: ['agent']}, maxCommentPosts: 1,
    });
    const pages: Array<{page: number; cursor?: string}> = [];
    const client: LinkedInCrawlClient = {
      searchLinkedInPosts: async (_search, page, cursor) => {
        pages.push({page: page ?? 1, cursor});
        return {data: {items: page === 1 ? [post('one', 100), post('weak', 10)] : [post('one', 100)]}, credits_used: 5,
          pagination: {has_more: page === 1, ...(page === 1 ? {next_cursor: 'sc.page2'} : {})}};
      },
      getLinkedInComments: async () => ({data: {items: [{comment: {id: 'c1', text: 'How does it work?', author: {name: 'Reader'}, engagement: {reactions: 7}}}]}, credits_used: 5}),
    };
    const result = await runLinkedInCrawl({config, client, repository, dataRoot: root, runId: 'linkedin-test', now});
    expect(result.run.status).toBe('complete');
    expect(result.candidates).toHaveLength(1);
    expect(result.filteredOut).toBe(1);
    expect(result.budget.spentCredits).toBe(15);
    expect(pages).toEqual([{page: 1, cursor: undefined}, {page: 2, cursor: 'sc.page2'}]);
    expect(repository.listComments(result.candidates[0].candidateId)[0].text).toBe('How does it work?');
    expect(repository.listComments(result.candidates[0].candidateId)[0].likes).toBe(7);
    const pack = await prepareAnalysisPack({runId: 'linkedin-test', dataRoot: root, repository});
    expect(pack.pack.items[0].platform).toBe('linkedin');
    expect(pack.pack.researchCriteria?.analysisFocus).toContain('audience objections');
    expect(pack.promptPath).toContain('analysis-prompt.md');
    repository.close();
  });

  it('continues after a relevance-filtered empty page when SocialCrawl has more results', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brains-linkedin-'));
    const repository = ViralBrainsRepository.inMemory();
    const config = parseLinkedInCrawlConfig({analysisFocus: 'AI patterns', searches: [{query: 'AI', maxPages: 2}], maxCommentPosts: 0});
    let calls = 0;
    const client: LinkedInCrawlClient = {
      searchLinkedInPosts: async () => {
        calls += 1;
        return {data: {items: calls === 1 ? [] : [post('found', 100)]}, credits_used: 5, pagination: {has_more: calls === 1, next_cursor: calls === 1 ? 'sc.second' : undefined}};
      },
      getLinkedInComments: async () => { throw new Error('Unexpected comments call'); },
    };
    const result = await runLinkedInCrawl({config, client, repository, dataRoot: root, runId: 'linkedin-empty-page', now});
    expect(calls).toBe(2);
    expect(result.candidates).toHaveLength(1);
    repository.close();
  });

  it('records charged provider errors and does not keep searching after the budget is exhausted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brains-linkedin-'));
    const repository = ViralBrainsRepository.inMemory();
    const config = parseLinkedInCrawlConfig({analysisFocus: 'AI patterns', searches: [{query: 'AI', maxPages: 10}, {query: 'AI tools', maxPages: 10}], budget: {searchCredits: 90, commentsCredits: 0, reserveCredits: 10}});
    let calls = 0;
    const client: LinkedInCrawlClient = {
      searchLinkedInPosts: async () => {
        calls += 1;
        return {data: {items: [post(`post-${calls}`, 100)]}, credits_used: 5, pagination: {has_more: true, next_cursor: `sc.${calls + 1}`}};
      },
      getLinkedInComments: async () => { throw new Error('Unexpected comments call'); },
    };
    const result = await runLinkedInCrawl({config, client, repository, dataRoot: root, runId: 'linkedin-cap', now});
    expect(calls).toBe(18);
    expect(result.budget.spentCredits).toBe(90);
    repository.close();

    const failingRepository = ViralBrainsRepository.inMemory();
    const failingClient: LinkedInCrawlClient = {
      searchLinkedInPosts: async () => { throw new SocialCrawlError(500, '/linkedin/search/posts', {credits_used: 7}); },
      getLinkedInComments: async () => { throw new Error('Unexpected comments call'); },
    };
    const failure = await runLinkedInCrawl({config, client: failingClient, repository: failingRepository, dataRoot: root, runId: 'linkedin-charged-error', now});
    expect(failure.run.status).toBe('failed');
    expect(failure.budget.spentCredits).toBe(7);
    failingRepository.close();
  });

  it('counts charged comment failures against the comment allocation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brains-linkedin-'));
    const repository = ViralBrainsRepository.inMemory();
    const config = parseLinkedInCrawlConfig({
      analysisFocus: 'AI patterns', searches: [{query: 'AI'}], maxCommentPosts: 2,
      budget: {searchCredits: 5, commentsCredits: 5, reserveCredits: 90},
    });
    let commentCalls = 0;
    const client: LinkedInCrawlClient = {
      searchLinkedInPosts: async () => ({data: {items: [post('first', 100), post('second', 80)]}, credits_used: 5, pagination: {has_more: false}}),
      getLinkedInComments: async () => {
        commentCalls += 1;
        throw new SocialCrawlError(500, '/linkedin/post/comments', {credits_used: 5});
      },
    };
    const result = await runLinkedInCrawl({config, client, repository, dataRoot: root, runId: 'linkedin-comment-error', now});
    expect(commentCalls).toBe(1);
    expect(result.budget.spentCredits).toBe(10);
    expect(result.run.status).toBe('partial');
    repository.close();
  });
});
