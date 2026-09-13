import {describe, expect, it} from 'vitest';

import {enrichWithFirecrawl} from '../src/lib/firecrawl.js';

describe('firecrawl enrichment', () => {
  it('skips Firecrawl enrichment when disabled', async () => {
    await expect(enrichWithFirecrawl([], {enabled: false, maxSources: 3, videoId: 'test'})).resolves.toEqual([]);
  });
});
