import {mkdtemp, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {writeDeterministicJson} from '../src/artifacts/json.js';
import {createScalePaths} from '../src/artifacts/paths.js';
import {buildCalendar} from '../src/artifacts/calendar.js';
import {listLatestRunSummaries} from '../src/artifacts/runs.js';
import {parseContentItem, type ContentItem} from '../src/config/schema.js';
import {prepareContentItems} from '../src/content/normalize.js';
import {runCli} from '../src/cli/index.js';

const project = {
  projectId: 'gaclight',
  name: 'G@CLight',
  timezone: 'Europe/Warsaw',
  platforms: {
    threads: {
      threadsUserId: '123',
      accessTokenEnv: 'THREADS_ACCESS_TOKEN',
    },
  },
};

const contentItem = (overrides: Record<string, unknown> = {}): ContentItem =>
  parseContentItem({
    id: 'item-1',
    projectId: 'gaclight',
    title: 'Thread',
    body: 'Hello from Threads',
    scheduledAt: '2026-04-25T10:00:00.000Z',
    status: 'draft',
    source: {type: 'manual', path: 'input/content/item.json'},
    assets: [],
    platforms: {threads: {postType: 'text'}},
    history: [],
    ...overrides,
  });

const makeTempDir = () => mkdtemp(path.join(os.tmpdir(), 'genius-scale-'));

const readJson = async (filePath: string) => JSON.parse(await readFile(filePath, 'utf8')) as unknown;

describe('artifact helpers', () => {
  it('writeDeterministicJson sorts object keys', async () => {
    const outputRoot = await makeTempDir();
    const filePath = path.join(outputRoot, 'nested', 'value.json');

    const writtenPath = await writeDeterministicJson(filePath, {z: 1, a: {d: 4, b: 2}, c: [{y: 2, x: 1}]});

    expect(writtenPath).toBe(filePath);
    expect(await readFile(filePath, 'utf8')).toBe(
      '{\n  "a": {\n    "b": 2,\n    "d": 4\n  },\n  "c": [\n    {\n      "x": 1,\n      "y": 2\n    }\n  ],\n  "z": 1\n}\n',
    );
  });

  it('createScalePaths keeps unsafe item run directories inside runsRoot', async () => {
    const outputRoot = await makeTempDir();
    const paths = createScalePaths({outputRoot});
    const runDir = paths.getItemRunDir('../outside');
    const relativeRunDir = path.relative(paths.runsRoot, runDir);

    expect(path.isAbsolute(relativeRunDir)).toBe(false);
    expect(relativeRunDir.startsWith('..')).toBe(false);
    expect(runDir).not.toBe(path.resolve(outputRoot, 'outside'));
  });

  it('buildCalendar sorts entries by scheduledAt and includes latestRun from provided run summary array', () => {
    const latestRun = {
      itemId: 'item-early',
      type: 'dry_run' as const,
      status: 'ok' as const,
      artifactPath: 'runs/item-early/run.json',
      createdAt: '2026-04-24T09:00:00.000Z',
    };

    const calendar = buildCalendar(
      [
        contentItem({id: 'item-late', scheduledAt: '2026-04-26T10:00:00.000Z', status: 'ready'}),
        contentItem({id: 'item-early', scheduledAt: '2026-04-25T10:00:00.000Z', status: 'dry_run_ok'}),
      ],
      [project],
      [latestRun],
    );

    expect(calendar.entries.map((entry) => entry.id)).toEqual(['item-early', 'item-late']);
    expect(calendar.entries[0]).toMatchObject({
      projectName: 'G@CLight',
      timezone: 'Europe/Warsaw',
      latestRun,
    });
  });

  it('prepareContentItems changes draft to ready and appends a prepare history event', () => {
    const prepared = prepareContentItems([contentItem()], '2026-04-24T08:00:00.000Z');

    expect(prepared[0].status).toBe('ready');
    expect(prepared[0].history).toContainEqual({
      type: 'prepare',
      status: 'ok',
      createdAt: '2026-04-24T08:00:00.000Z',
    });
  });

  it('prepareContentItems appends a prepare history event without changing non-draft status', () => {
    const prepared = prepareContentItems([contentItem({status: 'ready'})], '2026-04-24T08:00:00.000Z');

    expect(prepared[0].status).toBe('ready');
    expect(prepared[0].history).toContainEqual({
      type: 'prepare',
      status: 'ok',
      createdAt: '2026-04-24T08:00:00.000Z',
    });
  });
});

describe('artifact cli', () => {
  it('runCli dry-run writes a run artifact and calendar', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready'})]));

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const paths = createScalePaths({outputRoot});
    const calendar = await readJson(paths.calendarFile);
    const runs = await listLatestRunSummaries(paths);

    expect(calendar).toMatchObject({
      entries: [
        {
          id: 'item-1',
          status: 'dry_run_ok',
          latestRun: {type: 'dry_run', status: 'ok'},
        },
      ],
    });
    expect(runs).toContainEqual(expect.objectContaining({itemId: 'item-1', type: 'dry_run', status: 'ok'}));
  });

  it('dry-run preserves unsafe logical item IDs through run listing and calendar latestRun', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const unsafeItemId = '../outside';

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({id: unsafeItemId, status: 'ready'})]));

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const paths = createScalePaths({outputRoot});
    const runs = await listLatestRunSummaries(paths);
    const calendar = await readJson(paths.calendarFile);

    expect(runs).toContainEqual(expect.objectContaining({itemId: unsafeItemId, type: 'dry_run', status: 'ok'}));
    expect(calendar).toMatchObject({
      entries: [
        {
          id: unsafeItemId,
          latestRun: {itemId: unsafeItemId, type: 'dry_run', status: 'ok'},
        },
      ],
    });
  });

  it('successful dry-run writes prepared item status dry_run_ok and appends a dry_run history event', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'draft'})]));

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as Array<Record<string, unknown>>;

    expect(preparedItems[0].status).toBe('dry_run_ok');
    expect(preparedItems[0].history).toContainEqual(expect.objectContaining({type: 'dry_run', status: 'ok'}));
  });

  it('failed dry-run writes prepared item status validation_failed and appends a failed dry_run history event', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready', body: ''})]));

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as Array<Record<string, unknown>>;

    expect(preparedItems[0].status).toBe('validation_failed');
    expect(preparedItems[0].history).toContainEqual(expect.objectContaining({type: 'dry_run', status: 'failed'}));
  });

  it('dry-run rejects project mismatches before writing run artifacts or calendar', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const paths = createScalePaths({outputRoot});

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({projectId: 'other-project', status: 'ready'})]));

    await expect(
      runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]),
    ).rejects.toThrow('Content item item-1 belongs to project other-project but project file is gaclight');

    await expect(stat(paths.runsRoot)).rejects.toMatchObject({code: 'ENOENT'});
    await expect(stat(paths.calendarFile)).rejects.toMatchObject({code: 'ENOENT'});
    expect(await readdir(outputRoot).then((entries) => entries.sort())).toEqual(['content.json', 'project.json']);
  });

  it('dry-run --item rejects unselected project mismatches before writing artifacts', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const paths = createScalePaths({outputRoot});

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(
      contentPath,
      JSON.stringify([
        contentItem({id: 'selected', status: 'ready'}),
        contentItem({id: 'other-item', projectId: 'other-project', status: 'ready'}),
      ]),
    );

    await expect(
      runCli([
        'dry-run',
        '--item',
        'selected',
        '--content-file',
        contentPath,
        '--project-file',
        projectPath,
        '--output-root',
        outputRoot,
      ]),
    ).rejects.toThrow('Content item other-item belongs to project other-project but project file is gaclight');

    await expect(stat(paths.runsRoot)).rejects.toMatchObject({code: 'ENOENT'});
    await expect(stat(paths.preparedItemsFile)).rejects.toMatchObject({code: 'ENOENT'});
    await expect(stat(paths.calendarFile)).rejects.toMatchObject({code: 'ENOENT'});
    expect(await readdir(outputRoot).then((entries) => entries.sort())).toEqual(['content.json', 'project.json']);
  });

  it('runCli publish without --item throws a clear error', async () => {
    await expect(runCli(['publish'])).rejects.toThrow('publish requires --item <id>');
  });
});
