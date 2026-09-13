import {mkdtemp, readFile, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createScalePaths} from '../src/artifacts/paths.js';
import {runCli} from '../src/cli/index.js';
import {loadContentItemsFromFile, loadProjectFromFile} from '../src/config/loaders.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleProjectPath = path.join(packageRoot, 'input', 'projects', 'sample-project.json');
const sampleContentPath = path.join(packageRoot, 'input', 'content', 'sample-thread.json');

const makeTempDir = () => mkdtemp(path.join(os.tmpdir(), 'genius-scale-samples-'));

const readJson = async (filePath: string) => JSON.parse(await readFile(filePath, 'utf8')) as unknown;

describe('sample inputs', () => {
  it('loads and parses the sample project config', async () => {
    await expect(loadProjectFromFile(sampleProjectPath)).resolves.toMatchObject({
      projectId: 'gaclight',
      name: 'G@CLight',
      timezone: 'Europe/Warsaw',
      platforms: {
        threads: {
          threadsUserId: 'THREADS_USER_ID_PLACEHOLDER',
          accessTokenEnv: 'THREADS_ACCESS_TOKEN',
        },
      },
    });
  });

  it('loads and parses the sample carousel content item', async () => {
    const items = await loadContentItemsFromFile(sampleContentPath);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'gaclight-sample-thread',
      projectId: 'gaclight',
      platforms: {threads: {postType: 'carousel'}},
    });
    expect(items[0].assets).toEqual([
      expect.objectContaining({id: 'sample-cover', localPath: expect.any(String), publicUrl: expect.any(String)}),
      expect.objectContaining({id: 'sample-detail', localPath: expect.any(String)}),
    ]);
    expect(items[0].assets[1].publicUrl).toBeUndefined();
  });

  it('runs dry-run against the samples with a temp output root and generates calendar.json', async () => {
    const outputRoot = await makeTempDir();
    const paths = createScalePaths({outputRoot});

    await expect(
      runCli([
        'dry-run',
        '--project-file',
        sampleProjectPath,
        '--content-file',
        sampleContentPath,
        '--output-root',
        outputRoot,
      ]),
    ).resolves.toBe('Dry-run completed for 1 item(s).');

    const calendarStats = await stat(paths.calendarFile);
    expect(calendarStats.isFile()).toBe(true);
    await expect(readJson(paths.calendarFile)).resolves.toMatchObject({
      entries: [
        {
          id: 'gaclight-sample-thread',
          status: 'dry_run_ok',
          latestRun: {type: 'dry_run', status: 'ok'},
        },
      ],
    });
  });
});
