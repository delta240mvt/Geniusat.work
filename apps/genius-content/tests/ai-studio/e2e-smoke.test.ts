import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {main} from '../../src/ai-studio/cli.js';
import {writeConfigFixture} from './fixtures.js';

describe('ai studio e2e smoke', () => {
  it('builds a synthetic script into a 4-shot job pack without private workspace data', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-studio-e2e-'));
    try {
    await writeConfigFixture(tmpDir);
    const result = await main(['build', '--script-id', 'demo_publish'], {contentRoot:tmpDir});

    expect(fs.existsSync(path.join(result.jobRoot, 'shots', '01-zoe-open'))).toBe(true);
    expect(fs.existsSync(path.join(result.jobRoot, 'shots', '02-elena-response'))).toBe(true);
    expect(fs.existsSync(path.join(result.jobRoot, 'shots', '03-zoe-reaction'))).toBe(true);
    expect(fs.existsSync(path.join(result.jobRoot, 'shots', '04-elena-cta'))).toBe(true);
    } finally { fs.rmSync(tmpDir, {recursive:true, force:true}); }
  });
});
