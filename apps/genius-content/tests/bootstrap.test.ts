import {describe, expect, it} from 'vitest';

import {loadProjectConfig} from '../src/lib/config.js';

describe('project bootstrap', () => {
  it('loads the local project config file', async () => {
    await expect(loadProjectConfig()).resolves.toMatchObject({
      videoIntelligence: expect.any(Object),
      video: expect.any(Object),
    });
  });
});
