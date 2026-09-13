import {describe, expect, it} from 'vitest';

import {buildVideoAnnotationRequest} from '../src/lib/google-video-intelligence.js';

describe('google video intelligence', () => {
  it('builds a REST annotation request with the configured features', async () => {
    const request = buildVideoAnnotationRequest({
      inputContent: 'base64-video',
      features: ['LABEL_DETECTION'],
    });

    expect(request.features).toEqual(['LABEL_DETECTION']);
    expect(request.inputContent).toBe('base64-video');
  });
});
