import {describe, expect, it} from 'vitest';

import {normalizeSearchItems} from '../src/viral/socialcrawl.js';

describe('SocialCrawl normalization', () => {
  it('normalizes Instagram reel metrics and media without fabricating missing values', () => {
    const [result] = normalizeSearchItems(
      {
        data: {
          items: [
            {
              post: {
                id: 'ig-1',
                url: 'https://instagram.com/reel/ig-1',
                content: {text: 'AI agents', media_urls: ['https://cdn.example/ig.mp4'], thumbnail_url: 'https://cdn.example/thumb.jpg'},
                author: {username: 'creator', display_name: 'Creator'},
                engagement: {views: 5000, likes: 400, comments: 30},
                published_at: '2026-09-20T10:00:00.000Z',
              },
            },
          ],
        },
      },
      {runId: 'run-1', platform: 'instagram', language: 'en', subtopic: 'AI agents', query: 'AI agents', rawPayloadPath: 'raw.json'},
    );

    expect(result).toMatchObject({
      candidateId: 'instagram:ig-1',
      contentType: 'reel',
      metrics: {views: 5000, likes: 400, comments: 30, shares: null},
      mediaUrls: ['https://cdn.example/ig.mp4'],
    });
  });

  it('normalizes Threads posts and keeps replies/reposts separate from comments', () => {
    const [result] = normalizeSearchItems(
      {
        data: {
          items: [
            {
              post: {
                id: 'th-1',
                url: 'https://threads.net/@creator/post/th-1',
                content: {text: 'AI agents are changing work'},
                author: {username: 'creator', display_name: 'Creator'},
                engagement: {likes: 120, comments: 18, reposts: 40, views: null},
                published_at: '2026-09-20T09:00:00.000Z',
              },
            },
          ],
        },
      },
      {runId: 'run-1', platform: 'threads', language: 'en', subtopic: 'AI agents', query: 'AI agents', rawPayloadPath: 'raw.json'},
    );

    expect(result).toMatchObject({
      candidateId: 'threads:th-1',
      contentType: 'post',
      metrics: {comments: 18, replies: 18, reposts: 40, views: null},
    });
  });

  it('does not mark a Threads image as Deepgram-eligible video', () => {
    const [result] = normalizeSearchItems(
      {data: {items: [{post: {id: 'th-image', url: 'https://threads.net/post/th-image', content: {text: 'AI diagram', media_urls: ['https://cdn.example/image.jpg'], media_type: 'image'}, engagement: {comments: 2}}}]}},
      {runId: 'run-1', platform: 'threads', language: 'en', subtopic: 'AI agents', query: 'AI agents', rawPayloadPath: 'raw.json'},
    );
    expect(result.contentType).toBe('post');
  });
});
