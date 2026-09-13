import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {writeConfigFixture} from './fixtures.js';
import {loadAiStudioConfig} from '../../src/ai-studio/config/load-config.js';

const tempDirs: string[] = [];

const createTempRoot = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-studio-config-'));
  tempDirs.push(tempRoot);
  return tempRoot;
};

const writeJson = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, {recursive: true, force: true})));
});

describe('loadAiStudioConfig', () => {
  it('loads and normalizes all AI Studio config manifests', async () => {
    const contentRoot = await createTempRoot();
    const {configRoot} = await writeConfigFixture(contentRoot);

    const config = await loadAiStudioConfig({contentRoot, configRoot});
    const studio = config.studio!;
    const shots = config.shots!;
    const prompts = config.prompts!;

    expect(studio.project.id).toBe('ai-studio');
    expect(studio.outputRootAbsolute).toBe(path.join(contentRoot, 'output', 'ai-studio', 'jobs'));
    expect(studio.sourceFileAbsolute).toBe(
      path.join(contentRoot, 'AI Studio', 'virality', 'Tworzenie Person AI do Promocji Memów.md'),
    );
    expect(config.personas.personas.zoe.referenceImages).toHaveLength(2);
    expect(config.personas.personas.zoe.referenceImages[0]!.absolutePath).toBe(path.join(contentRoot, 'AI Studio', 'Zoe_base.png'));
    expect(config.personas.personas.zoe.references[0]).toBe(path.join('AI Studio', 'Zoe_base.png'));
    expect(shots.sequence).toEqual(['zoe_open', 'elena_response', 'zoe_reaction', 'elena_cta']);
    expect(shots.definitions.zoe_reaction.frameMode).toBe('first_and_last');
    expect(prompts.nanoBanana.firstFrameTemplate).toContain('{{shotId}}');
  });

  it('rejects persona references that do not exist on disk', async () => {
    const contentRoot = await createTempRoot();
    const {configRoot} = await writeConfigFixture(contentRoot);
    await fs.rm(path.join(contentRoot, 'AI Studio', 'Zoe_base.png'));

    await expect(loadAiStudioConfig({contentRoot, configRoot})).rejects.toThrow(/Zoe_base\.png/i);
  });

  it('rejects invalid shot frame modes during schema validation', async () => {
    const contentRoot = await createTempRoot();
    const {configRoot, fixture} = await writeConfigFixture(contentRoot);

    fixture.shots.definitions.zoe_open.frameMode = 'middle_only';
    await writeJson(path.join(configRoot, 'shots.json'), fixture.shots);

    await expect(loadAiStudioConfig({contentRoot, configRoot})).rejects.toThrow(/frameMode/i);
  });

  it('preserves allow_adult person generation for Veo defaults', async () => {
    const contentRoot = await createTempRoot();
    const {configRoot} = await writeConfigFixture(contentRoot);

    const config = await loadAiStudioConfig({contentRoot, configRoot});

    expect(config.models.veo.personGeneration).toBe('allow_adult');
  });
});
