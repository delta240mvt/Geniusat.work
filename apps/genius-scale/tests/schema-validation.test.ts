import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {describe, expect, it} from 'vitest';
import {parseContentItem, parseProjectConfig} from '../src/config/schema.js';
import {validateForThreadsDryRun, validateForThreadsPublish} from '../src/content/validation.js';
import {runCli} from '../src/cli/index.js';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const baseContentItem = {
  id: 'item-1',
  projectId: 'gaclight',
  title: 'Thread',
  body: 'Hello',
  scheduledAt: '2026-04-25T10:00:00.000Z',
  status: 'ready',
  source: {type: 'manual', path: 'input/content/item.json'},
  assets: [],
  platforms: {threads: {postType: 'text'}},
  history: [],
};

const parseItem = (overrides: Record<string, unknown> = {}) =>
  parseContentItem({
    ...baseContentItem,
    ...overrides,
  });

describe('cli', () => {
  it('returns help when no command is provided', async () => {
    await expect(runCli([])).resolves.toContain('Genius@Scale');
  });

  it('throws a clear error when prepare is missing a content file', async () => {
    await expect(runCli(['prepare'])).rejects.toThrow('prepare requires --content-file <path>');
  });

  it('throws a clear error when dry-run is missing a content file', async () => {
    await expect(runCli(['dry-run'])).rejects.toThrow('dry-run requires --content-file <path>');
  });

  it('exposes a Node-executable package bin shim', async () => {
    const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as {
      bin: {'genius-scale': string};
    };

    expect(packageJson.bin['genius-scale']).toBe('./bin/genius-scale.mjs');

    const {stdout} = await execFileAsync(
      process.execPath,
      [path.join(packageRoot, packageJson.bin['genius-scale'])],
      {cwd: packageRoot},
    );

    expect(stdout).toContain('Genius@Scale CLI');
  });
});

describe('project schema', () => {
  it('parses non-secret Threads project config', () => {
    expect(parseProjectConfig(project).platforms.threads?.accessTokenEnv).toBe('THREADS_ACCESS_TOKEN');
  });
});

describe('content schema and validation', () => {
  it('requires an explicit Threads postType', () => {
    expect(() =>
      parseContentItem({
        id: 'item-1',
        projectId: 'gaclight',
        title: 'No post type',
        body: 'Hello',
        scheduledAt: '2026-04-25T10:00:00.000Z',
        status: 'draft',
        source: {type: 'manual', path: 'input/content/item.json'},
        assets: [],
        platforms: {threads: {}},
        history: [],
      }),
    ).toThrow();
  });

  it('allows dry-run diagnostics without public media URLs', () => {
    const item = parseContentItem({
      id: 'item-image',
      projectId: 'gaclight',
      title: 'Image',
      body: 'Image post',
      scheduledAt: '2026-04-25T10:00:00.000Z',
      status: 'ready',
      source: {type: 'manual', path: 'input/content/item.json'},
      assets: [{id: 'asset-1', type: 'image', localPath: 'assets/a.png'}],
      platforms: {threads: {postType: 'image'}},
      history: [],
    });

    const result = validateForThreadsDryRun(item, project);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({code: 'missing_public_url'}));
  });

  it('blocks real publish when media publicUrl is missing', () => {
    const item = parseContentItem({
      id: 'item-image',
      projectId: 'gaclight',
      title: 'Image',
      body: 'Image post',
      scheduledAt: '2026-04-25T10:00:00.000Z',
      status: 'ready',
      source: {type: 'manual', path: 'input/content/item.json'},
      assets: [{id: 'asset-1', type: 'image', localPath: 'assets/a.png'}],
      platforms: {threads: {postType: 'image'}},
      history: [],
    });

    const result = validateForThreadsPublish(item, project, {hasAccessToken: true});

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({code: 'missing_public_url'}));
  });

  it.each([
    {body: '', ok: false},
    {body: 'a', ok: true},
    {body: 'a'.repeat(500), ok: true},
    {body: 'a'.repeat(501), ok: false},
  ])('validates Threads body length boundary for length $body.length', ({body, ok}) => {
    const item = parseItem({body});

    expect(validateForThreadsDryRun(item, project).ok).toBe(ok);
  });

  it.each([
    {postType: 'text', assets: [], ok: true},
    {postType: 'text', assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png'}], ok: false},
    {postType: 'image', assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png'}], ok: true},
    {postType: 'image', assets: [], ok: false},
    {postType: 'image', assets: [{id: 'asset-1', type: 'video', publicUrl: 'https://example.com/a.mp4'}], ok: false},
    {postType: 'video', assets: [{id: 'asset-1', type: 'video', publicUrl: 'https://example.com/a.mp4'}], ok: true},
    {postType: 'video', assets: [], ok: false},
    {postType: 'video', assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png'}], ok: false},
    {
      postType: 'carousel',
      assets: [
        {id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png'},
        {id: 'asset-2', type: 'video', publicUrl: 'https://example.com/b.mp4'},
      ],
      ok: true,
    },
    {postType: 'carousel', assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png'}], ok: false},
    {
      postType: 'carousel',
      assets: Array.from({length: 21}, (_, index) => ({
        id: `asset-${index}`,
        type: 'image',
        publicUrl: `https://example.com/${index}.png`,
      })),
      ok: false,
    },
  ])('validates $postType asset count and type rules', ({postType, assets, ok}) => {
    const item = parseItem({
      assets,
      platforms: {threads: {postType}},
    });

    expect(validateForThreadsDryRun(item, project).ok).toBe(ok);
  });

  it('blocks publish when Threads project config is missing', () => {
    const item = parseItem();
    const result = validateForThreadsPublish(
      item,
      parseProjectConfig({...project, platforms: {}}),
      {hasAccessToken: true},
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({code: 'missing_threads_user_id'}));
    expect(result.errors).toContainEqual(expect.objectContaining({code: 'missing_access_token_env'}));
  });

  it('blocks publish when accessTokenEnv is missing', () => {
    const item = parseItem();
    const result = validateForThreadsPublish(
      item,
      parseProjectConfig({...project, platforms: {threads: {threadsUserId: '123'}}}),
      {hasAccessToken: true},
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({code: 'missing_access_token_env'}));
  });

  it('blocks publish when the actual Threads token is unavailable', () => {
    const item = parseItem();
    const result = validateForThreadsPublish(item, project, {hasAccessToken: false});

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({code: 'missing_access_token'}));
  });
});
