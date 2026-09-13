import {describe, expect, it} from 'vitest';

import {normalizeAnalysis} from '../src/lib/normalize-analysis.js';

describe('normalize analysis', () => {
  it('maps shot annotations into normalized shots', () => {
    const result = normalizeAnalysis(
      {
        annotationResults: [
          {
            segment: {endTimeOffset: '8.0s'},
            shotAnnotations: [{startTimeOffset: '0.0s', endTimeOffset: '8.0s'}],
          },
        ],
      },
      [],
      'input/test.mov',
      'test',
    );

    expect(result.shots.length).toBeGreaterThan(0);
  });
});
