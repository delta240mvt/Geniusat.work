import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createScalePaths} from '../src/artifacts/paths.js';
import {parseContentItem, type ContentItem} from '../src/config/schema.js';
import {runCli} from '../src/cli/index.js';
import {createThreadsClient} from '../src/threads/client.js';
import {buildThreadsCreateRequests, buildThreadsDryRunPayload} from '../src/threads/payload.js';
import {publishContentItem} from '../src/threads/publish.js';
import {redactArtifactValue} from '../src/artifacts/redaction.js';
import {redactSecrets} from '../src/utils/env.js';

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
    status: 'ready',
    source: {type: 'manual', path: 'input/content/item.json'},
    assets: [],
    platforms: {threads: {postType: 'text'}},
    history: [],
    ...overrides,
  });

const makeTempDir = () => mkdtemp(path.join(os.tmpdir(), 'genius-scale-threads-'));

const readJson = async (filePath: string) => JSON.parse(await readFile(filePath, 'utf8')) as unknown;

const okResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  }) as Response;

const errorResponse = (status: number, body: unknown): Response =>
  ({
    ok: false,
    status,
    statusText: 'Error',
    text: async () => JSON.stringify(body),
  }) as Response;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Threads payload builder', () => {
  it('text payload creates one media_type TEXT request', () => {
    expect(buildThreadsCreateRequests(contentItem())).toEqual([
      {
        media_type: 'TEXT',
        text: 'Hello from Threads',
      },
    ]);
  });

  it('image payload requires image_url and includes alt_text', () => {
    const item = contentItem({
      assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png', altText: 'Alt copy'}],
      platforms: {threads: {postType: 'image'}},
    });

    expect(buildThreadsCreateRequests(item)).toEqual([
      {
        media_type: 'IMAGE',
        text: 'Hello from Threads',
        image_url: 'https://example.com/a.png',
        alt_text: 'Alt copy',
      },
    ]);

    expect(() =>
      buildThreadsCreateRequests(
        contentItem({
          assets: [{id: 'asset-1', type: 'image'}],
          platforms: {threads: {postType: 'image'}},
        }),
      ),
    ).toThrow('Threads image asset asset-1 requires publicUrl.');
  });

  it('dry-run image payload uses a placeholder for local-only assets', () => {
    const item = contentItem({
      assets: [{id: 'asset-1', type: 'image', localPath: 'assets/a.png', altText: 'Alt copy'}],
      platforms: {threads: {postType: 'image'}},
    });

    expect(buildThreadsDryRunPayload(item).requests).toEqual([
      {
        media_type: 'IMAGE',
        text: 'Hello from Threads',
        image_url: '<missing-public-url:asset-1>',
        alt_text: 'Alt copy',
      },
    ]);
  });

  it('video payload uses video_url', () => {
    const item = contentItem({
      assets: [{id: 'asset-1', type: 'video', publicUrl: 'https://example.com/a.mp4'}],
      platforms: {threads: {postType: 'video'}},
    });

    expect(buildThreadsCreateRequests(item)).toEqual([
      {
        media_type: 'VIDEO',
        text: 'Hello from Threads',
        video_url: 'https://example.com/a.mp4',
      },
    ]);
  });

  it('carousel creates child item payloads and parent media_type CAROUSEL', () => {
    const item = contentItem({
      assets: [
        {id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png', altText: 'First'},
        {id: 'asset-2', type: 'video', publicUrl: 'https://example.com/b.mp4'},
      ],
      platforms: {threads: {postType: 'carousel', replyControl: 'followers', topicTag: 'BuildInPublic'}},
    });

    expect(buildThreadsCreateRequests(item)).toEqual([
      {
        media_type: 'IMAGE',
        image_url: 'https://example.com/a.png',
        alt_text: 'First',
        is_carousel_item: true,
      },
      {
        media_type: 'VIDEO',
        video_url: 'https://example.com/b.mp4',
        is_carousel_item: true,
      },
      {
        media_type: 'CAROUSEL',
        text: 'Hello from Threads',
        children: [],
        reply_control: 'followers',
        topic_tag: 'BuildInPublic',
      },
    ]);

    expect(buildThreadsDryRunPayload(item).publish).toMatchObject({
      creation_id: '<container-id>',
    });
    expect(buildThreadsDryRunPayload(item).requests.at(-1)).toMatchObject({
      media_type: 'CAROUSEL',
      children: ['<child-container-asset-1>', '<child-container-asset-2>'],
    });
  });
});

describe('Threads publish flow', () => {
  it('createThreadsClient binds access token and exposes responseBody on API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(errorResponse(400, {error: {message: 'bad request'}}));
    const client = createThreadsClient({
      accessToken: 'secret-token',
      baseUrl: 'https://example.test/v1',
      fetchImpl: fetchMock,
    });

    await expect(client.createContainer('123', {media_type: 'TEXT', text: 'Hello'})).rejects.toMatchObject({
      status: 400,
      responseBody: {error: {message: 'bad request'}},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/v1/123/threads',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );
  });

  it('publishContentItem with mocked fetch calls container endpoints then publish endpoint', async () => {
    const item = contentItem({
      assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://example.com/a.png'}],
      platforms: {threads: {postType: 'image'}},
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({id: 'container-1'}))
      .mockResolvedValueOnce(okResponse({id: 'threads-post-1'}));

    const artifact = await publishContentItem({
      item,
      project,
      accessToken: 'secret-token',
      fetchImpl: fetchMock,
      createdAt: '2026-04-24T10:00:00.000Z',
    });

    expect(artifact.status).toBe('ok');
    expect(artifact.payloads).toEqual([
      expect.objectContaining({media_type: 'IMAGE', image_url: 'https://example.com/a.png'}),
      {creation_id: 'container-1'},
    ]);
    expect(artifact.response).toEqual(expect.objectContaining({publishResponse: {id: 'threads-post-1'}}));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.threads.net/v1.0/123/threads');
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.threads.net/v1.0/123/threads_publish');
  });

  it('publishContentItem rejects items not in ready or dry_run_ok with publish_blocked before API calls', async () => {
    const fetchMock = vi.fn();

    const artifact = await publishContentItem({
      item: contentItem({status: 'draft'}),
      project,
      accessToken: 'secret-token',
      fetchImpl: fetchMock,
      createdAt: '2026-04-24T10:00:00.000Z',
    });

    expect(artifact.status).toBe('blocked');
    expect(artifact.message).toContain('publish_blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Threads CLI publish', () => {
  it('dry-run writes redacted Threads request shapes into the per-item dry-run artifact', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready'})]));

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];
    const dryRunEvent = preparedItems[0].history.find((event) => event.type === 'dry_run');
    const artifact = (await readJson(dryRunEvent!.artifactPath!)) as {
      payloads: unknown[];
    };

    expect(artifact.payloads).toEqual([{media_type: 'TEXT', text: 'Hello from Threads'}, {creation_id: '<container-id>'}]);
  });

  it('dry-run redacts sensitive media URL query params in serialized artifacts', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const paths = createScalePaths({outputRoot});

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(
      contentPath,
      JSON.stringify([
        contentItem({
          status: 'ready',
          assets: [
            {
              id: 'asset-1',
              type: 'image',
              publicUrl:
                'https://cdn.example.com/a.png?width=1200&access_token=raw-access-secret&token=raw-token-secret&caption=keep',
            },
          ],
          platforms: {threads: {postType: 'image'}},
        }),
      ]),
    );

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const preparedItemsText = await readFile(paths.preparedItemsFile, 'utf8');
    const calendarText = await readFile(paths.calendarFile, 'utf8');
    const calendarMarkdown = await readFile(paths.calendarMarkdownFile, 'utf8');
    const preparedItems = JSON.parse(preparedItemsText) as ContentItem[];
    const artifactText = await readFile(preparedItems[0].history.at(-1)!.artifactPath!, 'utf8');
    const artifact = JSON.parse(artifactText) as {payloads: Array<{image_url?: string}>; payload: {requests: Array<{image_url?: string}>}};

    for (const serializedOutput of [preparedItemsText, calendarText, calendarMarkdown, artifactText]) {
      expect(serializedOutput).not.toContain('raw-access-secret');
      expect(serializedOutput).not.toContain('raw-token-secret');
    }

    expect(preparedItemsText).toContain('<redacted:17>');
    expect(calendarText).toContain('<redacted:17>');
    expect(artifactText).not.toContain('raw-access-secret');
    expect(artifactText).not.toContain('raw-token-secret');
    expect(artifactText).toContain('<redacted:17>');
    expect(artifactText).toContain('<redacted:16>');
    expect(artifact.payloads[0].image_url).toContain('width=1200');
    expect(artifact.payloads[0].image_url).toContain('caption=keep');
    expect(artifact.payload.requests[0].image_url).toBe(artifact.payloads[0].image_url);
  });

  it('dry-run redacts signed media URL query params in serialized artifacts', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const paths = createScalePaths({outputRoot});

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(
      contentPath,
      JSON.stringify([
        contentItem({
          status: 'ready',
          assets: [
            {
              id: 'asset-1',
              type: 'image',
              publicUrl:
                'https://cdn.example.com/a.png?X-Amz-Signature=raw-signature-secret&X-Amz-Security-Token=raw-token-secret&X-Amz-Credential=raw-credential-secret&caption=keep',
            },
          ],
          platforms: {threads: {postType: 'image'}},
        }),
      ]),
    );

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const preparedItemsText = await readFile(paths.preparedItemsFile, 'utf8');
    const calendarText = await readFile(paths.calendarFile, 'utf8');
    const calendarMarkdown = await readFile(paths.calendarMarkdownFile, 'utf8');
    const preparedItems = JSON.parse(preparedItemsText) as ContentItem[];
    const artifactText = await readFile(preparedItems[0].history.at(-1)!.artifactPath!, 'utf8');
    const artifact = JSON.parse(artifactText) as {payloads: Array<{image_url?: string}>; payload: {requests: Array<{image_url?: string}>}};

    for (const serializedOutput of [preparedItemsText, calendarText, calendarMarkdown, artifactText]) {
      expect(serializedOutput).not.toContain('raw-signature-secret');
      expect(serializedOutput).not.toContain('raw-token-secret');
      expect(serializedOutput).not.toContain('raw-credential-secret');
    }

    for (const serializedOutput of [preparedItemsText, calendarText, artifactText]) {
      expect(serializedOutput).toContain('caption=keep');
    }

    expect(artifact.payloads[0].image_url).toContain('caption=keep');
    expect(artifact.payload.requests[0].image_url).toBe(artifact.payloads[0].image_url);
  });

  it('keeps already-redacted URL query params idempotent', () => {
    const once = redactArtifactValue('https://cdn.example.com/a.png?access_token=<redacted:17>&caption=keep');
    const twice = redactArtifactValue(once);

    expect(twice).toBe(once);
    expect(twice).toBe('https://cdn.example.com/a.png?access_token=<redacted:17>&caption=keep');
    expect(twice).toContain('caption=keep');
  });

  it('dry-run local-only carousel writes placeholder request shapes and missing public URL warnings', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(
      contentPath,
      JSON.stringify([
        contentItem({
          status: 'ready',
          assets: [
            {id: 'asset-1', type: 'image', localPath: 'assets/a.png', altText: 'First'},
            {id: 'asset-2', type: 'video', localPath: 'assets/b.mp4'},
          ],
          platforms: {threads: {postType: 'carousel'}},
        }),
      ]),
    );

    await runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]);

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];
    const dryRunEvent = preparedItems[0].history.find((event) => event.type === 'dry_run');
    const artifact = (await readJson(dryRunEvent!.artifactPath!)) as {
      status: string;
      validation: {warnings: Array<{code: string}>};
      payloads: unknown[];
    };

    expect(preparedItems[0].status).toBe('dry_run_ok');
    expect(artifact.status).toBe('ok');
    expect(artifact.validation.warnings).toContainEqual(expect.objectContaining({code: 'missing_public_url'}));
    expect(artifact.payloads).toEqual([
      {
        media_type: 'IMAGE',
        image_url: '<missing-public-url:asset-1>',
        alt_text: 'First',
        is_carousel_item: true,
      },
      {
        media_type: 'VIDEO',
        video_url: '<missing-public-url:asset-2>',
        is_carousel_item: true,
      },
      {
        media_type: 'CAROUSEL',
        text: 'Hello from Threads',
        children: ['<child-container-asset-1>', '<child-container-asset-2>'],
      },
      {creation_id: '<container-id>'},
    ]);
  });

  it('dry-run invalid media shape writes failed diagnostic artifacts without throwing', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(
      contentPath,
      JSON.stringify([
        contentItem({
          status: 'ready',
          assets: [],
          platforms: {threads: {postType: 'image'}},
        }),
      ]),
    );

    await expect(
      runCli(['dry-run', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot]),
    ).resolves.toBe('Dry-run completed for 1 item(s).');

    const paths = createScalePaths({outputRoot});
    const preparedItems = (await readJson(paths.preparedItemsFile)) as ContentItem[];
    const dryRunEvent = preparedItems[0].history.find((event) => event.type === 'dry_run');
    const artifact = (await readJson(dryRunEvent!.artifactPath!)) as {
      status: string;
      validation: {errors: Array<{code: string}>};
      payloads?: unknown[];
    };
    const calendar = (await readJson(paths.calendarFile)) as {entries: Array<{latestRun?: {status: string}}>;};

    expect(preparedItems[0].status).toBe('validation_failed');
    expect(dryRunEvent).toMatchObject({type: 'dry_run', status: 'failed'});
    expect(artifact.status).toBe('failed');
    expect(artifact.validation.errors).toContainEqual(expect.objectContaining({code: 'invalid_asset_count'}));
    expect(artifact.payloads).toBeUndefined();
    expect(calendar.entries[0].latestRun).toMatchObject({status: 'failed'});
  });

  it('successful CLI publish updates the item to published and appends a publish history event', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({id: 'container-1'}))
      .mockResolvedValueOnce(okResponse({id: 'threads-post-1'}));
    vi.stubEnv('THREADS_ACCESS_TOKEN', 'secret-token');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'dry_run_ok'})]));

    await runCli(['publish', '--item', 'item-1', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot], {
      fetch: fetchMock,
    });

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];

    expect(preparedItems[0].status).toBe('published');
    expect(preparedItems[0].history).toContainEqual(expect.objectContaining({type: 'publish', status: 'ok'}));
  });

  it('validation-blocked CLI publish updates the item to publish_blocked and appends a blocked publish history event', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const fetchMock = vi.fn();
    vi.stubEnv('THREADS_ACCESS_TOKEN', 'secret-token');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready', body: ''})]));

    await runCli(['publish', '--item', 'item-1', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot], {
      fetch: fetchMock,
    });

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];

    expect(preparedItems[0].status).toBe('publish_blocked');
    expect(preparedItems[0].history).toContainEqual(expect.objectContaining({type: 'publish', status: 'blocked'}));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('missing token CLI publish returns a clear blocked message without API calls', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const fetchMock = vi.fn();

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready'})]));

    await expect(
      runCli(['publish', '--item', 'item-1', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot], {
        fetch: fetchMock,
      }),
    ).resolves.toBe('publish_blocked: missing Threads access token.');

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];

    expect(preparedItems[0].status).toBe('publish_blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API/runtime failed CLI publish updates the item to failed and appends a failed publish history event', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network down'));
    vi.stubEnv('THREADS_ACCESS_TOKEN', 'secret-token');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready'})]));

    await runCli(['publish', '--item', 'item-1', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot], {
      fetch: fetchMock,
    });

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];

    expect(preparedItems[0].status).toBe('failed');
    expect(preparedItems[0].history).toContainEqual(expect.objectContaining({type: 'publish', status: 'failed'}));
  });

  it('failed CLI publish preserves and redacts Threads API error response bodies', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    vi.stubEnv('THREADS_ACCESS_TOKEN', 'secret-token');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready'})]));

    await runCli(
      ['publish', '--item', 'item-1', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot],
      {
        fetch: vi.fn().mockResolvedValueOnce(
          errorResponse(400, {
            error: {
              message:
                'bad request https://graph.example.test/media?id=123&token=response-token-secret&signature=response-signature-secret&quality=high',
            },
          }),
        ),
      },
    );

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];
    const artifactText = await readFile(preparedItems[0].history.at(-1)!.artifactPath!, 'utf8');
    const artifact = JSON.parse(artifactText) as {response: {errorBody?: unknown}};

    expect(artifact.response.errorBody).toEqual({
      error: {
        message:
          'bad request https://graph.example.test/media?id=123&token=<redacted:21>&signature=<redacted:25>&quality=high',
      },
    });
    expect(artifactText).not.toContain('response-token-secret');
    expect(artifactText).not.toContain('response-signature-secret');
    expect(artifactText).toContain('quality=high');
  });

  it('tokens are masked in serialized dry-run output', async () => {
    const outputRoot = await makeTempDir();
    const projectPath = path.join(outputRoot, 'project.json');
    const contentPath = path.join(outputRoot, 'content.json');
    vi.stubEnv('THREADS_ACCESS_TOKEN', 'secret-token');

    await writeFile(projectPath, JSON.stringify(project));
    await writeFile(contentPath, JSON.stringify([contentItem({status: 'ready'})]));

    await runCli(['publish', '--item', 'item-1', '--content-file', contentPath, '--project-file', projectPath, '--output-root', outputRoot], {
      fetch: vi
        .fn()
        .mockResolvedValueOnce(okResponse({id: 'container-1', tokenEcho: 'secret-token'}))
        .mockResolvedValueOnce(okResponse({id: 'threads-post-1'})),
    });

    const preparedItems = (await readJson(createScalePaths({outputRoot}).preparedItemsFile)) as ContentItem[];
    const artifactText = await readFile(preparedItems[0].history.at(-1)!.artifactPath!, 'utf8');

    expect(artifactText).not.toContain('secret-token');
    expect(artifactText).toContain('<redacted:');
  });

  it('exported redactSecrets accepts one argument and masks environment secrets', () => {
    vi.stubEnv('THREADS_ACCESS_TOKEN', 'secret-token');

    expect(redactSecrets({access_token: 'secret-token'})).toEqual({access_token: '<redacted:12>'});
  });
});
