import {describe, expect, it} from 'vitest';

import {main} from '../scripts/run-transcript-stage.js';

describe('cli', () => {
  it('rejects a missing input path', async () => {
    await expect(main([])).rejects.toThrow(/input/i);
  });
});
