import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {main} from '../../src/ai-studio/cli.js';
import {writeConfigFixture} from './fixtures.js';

let contentRoot: string;
beforeEach(async () => {
  contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-studio-cli-'));
  await writeConfigFixture(contentRoot);
});
afterEach(() => fs.rmSync(contentRoot, {recursive:true, force:true}));

describe('ai studio cli', () => {
  it('rejects build without script id', async () => {
    await expect(main(['build'], {contentRoot})).rejects.toThrow(/script-id/i);
  });

  it('lists scripts', async () => {
    const result = await main(['list-scripts'], {contentRoot});
    expect(result.scripts.map((script: {script_id: string}) => script.script_id)).toContain('demo_publish');
  });

  it('builds a job pack', async () => {
    const result = await main(['build', '--script-id', 'demo_publish'], {contentRoot});
    expect(result.jobRoot).toBeTruthy();
    expect(fs.existsSync(path.join(result.jobRoot, 'job.json'))).toBe(true);
  });
});
