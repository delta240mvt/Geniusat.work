import {describe, expect, it} from 'vitest';

import {loadProjectConfig} from '../src/lib/config.js';
import {generateStoryboard} from '../src/lib/generate-storyboard.js';
import {createEmptyAnalysisDocument} from '../src/types/analysis.js';

describe('storyboard generation', () => {
  it('creates storyboard scenes from shot changes', async () => {
    const config = await loadProjectConfig();
    const analysis = createEmptyAnalysisDocument('input/test.mov', 'test', 4_000);
    analysis.shots = [{startMs: 0, endMs: 4_000}];
    analysis.labels = [{description: 'camera', confidence: 0.9}];

    const storyboard = generateStoryboard(analysis, config);
    expect(storyboard[0]).toMatchObject({
      hookText: expect.any(String),
      caption: expect.any(String),
    });
  });
});
