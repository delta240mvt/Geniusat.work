import {describe, expect, it} from 'vitest';
import {parsePipelineArgs} from '../scripts/pipeline.js';

describe('pipeline commands', () => {
  it('accepts a quoted video path and uses Hyperframes by default', () => {
    expect(parsePipelineArgs(['input/my clip.MOV', '--engine', 'hyperframes', '--prepare']))
      .toMatchObject({engine: 'hyperframes', prepare: true});
    expect(parsePipelineArgs(['input/clip.mp4'])).toMatchObject({engine: 'hyperframes', prepare: false});
  });
  it('rejects missing input, unsupported media and unknown engines', () => {
    expect(() => parsePipelineArgs([])).toThrow(/nagrania/);
    expect(() => parsePipelineArgs(['clip.png'])).toThrow(/MOV/);
    expect(() => parsePipelineArgs(['clip.mov', '--engine', 'invalid'])).toThrow(/Silnik/);
    expect(() => parsePipelineArgs(['clip.mov', '--engine', 'remotion'])).toThrow(/Hyperframes/);
  });
});
