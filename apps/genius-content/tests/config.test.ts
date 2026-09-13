import {describe, expect, it} from 'vitest';

import {loadEnv} from '../src/lib/env.js';

describe('env config', () => {
  it('allows local editing and rendering without cloud credentials', () => {
    expect(loadEnv({}).FIRECRAWL_API_KEY).toBe('');
    expect(loadEnv({}).GEMINI_API_KEY).toBe('');
  });
  it('reads optional credentials without changing them', () => {
    expect(loadEnv({GEMINI_API_KEY: 'test-key'}).GEMINI_API_KEY).toBe('test-key');
  });
});
