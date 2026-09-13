import {describe, expect, it} from 'vitest';

import {createEmptyAnalysisDocument} from '../src/types/analysis.js';

describe('analysis schema', () => {
  it('creates an empty normalized analysis document with storyboard array', () => {
    const doc = createEmptyAnalysisDocument('input/test.mov', 'test-video', 1200);
    expect(doc.storyboard).toEqual([]);
    expect(doc.videoId).toBe('test-video');
  });
});
