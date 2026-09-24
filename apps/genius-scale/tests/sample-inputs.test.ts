import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {createScalePaths} from '../src/artifacts/paths.js';
import {runCli} from '../src/cli/index.js';
import {loadContentItemsFromFile, loadProjectFromFile} from '../src/config/loaders.js';

let fixtureRoot: string;
let sampleProjectPath: string;
let sampleContentPath: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'genius-scale-inputs-'));
  sampleProjectPath = path.join(fixtureRoot, 'project.json');
  sampleContentPath = path.join(fixtureRoot, 'content.json');
  await writeFile(sampleProjectPath, JSON.stringify({
    projectId: 'fixture-project', name: 'Synthetic project', timezone: 'Europe/Warsaw',
    platforms: {threads: {threadsUserId: 'THREADS_USER_ID_PLACEHOLDER', accessTokenEnv: 'THREADS_ACCESS_TOKEN'}},
  }));
  await writeFile(sampleContentPath, JSON.stringify({
    id: 'fixture-thread', projectId: 'fixture-project', title: 'Synthetic carousel',
    body: 'Test-only content.', scheduledAt: '2026-04-27T09:00:00.000+02:00', status: 'ready',
    source: {type: 'manual', path: 'synthetic/content.json'},
    assets: [
      {id: 'sample-cover', type: 'image', localPath: 'synthetic/cover.png', publicUrl: 'https://example.com/cover.png', altText: 'Synthetic cover'},
      {id: 'sample-detail', type: 'image', localPath: 'synthetic/detail.png', altText: 'Synthetic detail'},
    ],
    platforms: {threads: {postType: 'carousel', replyControl: 'everyone', topicTag: 'Example'}},
    history: [],
  }));
});

afterAll(async () => {
  if (fixtureRoot) await rm(fixtureRoot, {recursive: true, force: true});
});

const makeTempDir = () => mkdtemp(path.join(os.tmpdir(), 'genius-scale-samples-'));

const readJson = async (filePath: string) => JSON.parse(await readFile(filePath, 'utf8')) as unknown;

describe('sample inputs', () => {
  it('loads and parses the sample project config', async () => {
    await expect(loadProjectFromFile(sampleProjectPath)).resolves.toMatchObject({
      projectId: 'fixture-project',
      name: 'Synthetic project',
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
      id: 'fixture-thread',
      projectId: 'fixture-project',
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
          id: 'fixture-thread',
          status: 'dry_run_ok',
          latestRun: {type: 'dry_run', status: 'ok'},
        },
      ],
    });
  });
});
