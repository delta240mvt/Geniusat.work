import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  createCanvasConfig,
  createCanvasServer,
  listAnalysisEntries,
  readBrainsRuns,
  readContentRuns,
  readPreviewAssets,
  readScaleCalendar,
  resolveRequestPath,
} from './index.js';
import {readViralBrainsDashboard} from './brains-intelligence.js';
import type {ScaleCalendar} from './index.js';
import {reelCatalog} from './reels.js';

test('reel catalog preserves path separators for relative preview media',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'delta-catalog-'));
  const app=path.join(root,'apps/genius-content');
  await mkdir(path.join(app,'reels'),{recursive:true});
  await mkdir(path.join(app,'public/reels/demo'),{recursive:true});
  await writeFile(path.join(app,'reels/demo.json'),JSON.stringify({id:'demo',clips:[{start:0,end:3}]}));
  await writeFile(path.join(app,'reels/broken.json'),'{incomplete');
  await writeFile(path.join(app,'public/reels/demo/index.html'),'<html>preview</html>');
  const catalog=await reelCatalog(createCanvasConfig({workspaceRoot:root}));
  assert.equal(catalog.reels[0].previewUrl,'/api/workspace/apps/genius-content/public/reels/demo/index.html?preview=1');
  assert.equal(catalog.reels[0].duration,3);
  assert.equal(catalog.reels.length,1);
  assert.match(catalog.warnings[0], /broken.json/);
});

test('video playback supports byte ranges and rejects invalid ranges',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'delta-range-'));
  await writeFile(path.join(root,'clip.mp4'),'0123456789');
  const server=createCanvasServer(createCanvasConfig({videoRoot:root}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  const url=`http://127.0.0.1:${address.port}/api/video/clip.mp4`;
  try {
    const partial=await fetch(url,{headers:{Range:'bytes=2-5'}});
    assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 2-5/10');assert.equal(await partial.text(),'2345');
    const suffix=await fetch(url,{headers:{Range:'bytes=-3'}});assert.equal(await suffix.text(),'789');
    const invalid=await fetch(url,{headers:{Range:'bytes=30-40'}});assert.equal(invalid.status,416);
    const forbidden=await fetch(`http://127.0.0.1:${address.port}/api/reels`,{method:'POST',headers:{Origin:'https://external.example'},body:'{}'});
    assert.equal(forbidden.status,403);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('createCanvasConfig derives package, analysis, and video roots from a workspace root', () => {
  const workspaceRoot = 'C:\\repo';
  const expectedPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  const config = createCanvasConfig({workspaceRoot});

  assert.equal(config.workspaceRoot, workspaceRoot);
  assert.equal(config.packageRoot, expectedPackageRoot);
  assert.equal(config.publicRoot, path.join(expectedPackageRoot, 'public'));
  assert.equal(config.analysisRoot, path.join(workspaceRoot, 'apps', 'genius-content', 'output', 'analysis'));
  assert.equal(config.videoRoot, path.join(workspaceRoot, 'apps', 'genius-content', 'public', 'input'));
  assert.equal(config.scaleCalendarPath, path.join(workspaceRoot, 'apps', 'genius-scale', 'output', 'calendar.json'));
  assert.equal(config.port, 4188);
});

test('listAnalysisEntries excludes raw analysis artifacts and sorts newest first', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-analysis-'));

  await writeFile(path.join(root, 'older.json'), '{"ok":true}');
  await new Promise((resolve) => setTimeout(resolve, 15));
  await writeFile(path.join(root, 'ignore-raw.json'), '{}');
  await writeFile(path.join(root, 'ignore-google-raw.json'), '{}');
  await writeFile(path.join(root, 'ignore-firecrawl-raw.json'), '{}');
  await writeFile(path.join(root, 'newer.json'), '{"ok":true}');

  const files = await listAnalysisEntries(root);

  assert.deepEqual(
    files.map((entry) => entry.name),
    ['newer.json', 'older.json'],
  );
  assert.ok(files[0].updatedAt >= files[1].updatedAt);
});

test('resolveRequestPath maps API and static requests to package roots', () => {
  const config = createCanvasConfig({workspaceRoot: '/repo'});

  assert.equal(
    resolveRequestPath('/api/analysis/demo.json', config),
    path.join(config.analysisRoot, 'demo.json'),
  );
  assert.equal(
    resolveRequestPath('/api/video/demo.mov', config),
    path.join(config.videoRoot, 'demo.mov'),
  );
  assert.equal(
    resolveRequestPath('/api/workspace/apps/genius-content/output/demo.png', config),
    path.join(config.workspaceRoot, 'apps', 'genius-content', 'output', 'demo.png'),
  );
  assert.equal(
    resolveRequestPath('/', config),
    path.join(config.publicRoot, 'index.html'),
  );
  assert.equal(
    resolveRequestPath('/styles.css', config),
    path.join(config.publicRoot, 'styles.css'),
  );
});

test('resolveRequestPath rejects requests that escape the configured roots', () => {
  const config = createCanvasConfig({workspaceRoot: '/repo'});

  assert.throws(
    () => resolveRequestPath('/api/analysis/../secret.json', config),
    /Path escapes root/,
  );
  assert.throws(
    () => resolveRequestPath('/../../secret.txt', config),
    /Path escapes root/,
  );
});

test('preview blocks credentials and repository internals while allowing exported media', () => {
  const config = createCanvasConfig({workspaceRoot: '/repo'});
  for (const request of ['/api/workspace/.env', '/api/workspace/.git/config', '/api/workspace/service-account.json', '/api/workspace/apps/genius-content/public/.env', '/api/workspace/apps/genius-content/output/private.key']) {
    assert.throws(() => resolveRequestPath(request, config));
  }
  assert.ok(resolveRequestPath('/api/workspace/apps/genius-content/output/renders/demo.mp4', config).endsWith('demo.mp4'));
});

test('listAnalysisEntries returns an empty list when the analysis directory is missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-empty-'));
  const missing = path.join(root, 'analysis');

  const files = await listAnalysisEntries(missing);

  assert.deepEqual(files, []);
});

test('preview discovery reads content runs with prompts and non-video artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-content-preview-'));
  const runRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'job-one');
  const shotRoot = path.join(runRoot, 'shots', '001');

  await mkdir(shotRoot, {recursive: true});
  await writeFile(path.join(runRoot, 'job.json'), JSON.stringify({title: 'Launch reel', status: 'ready'}), 'utf8');
  await writeFile(path.join(shotRoot, 'prompt.txt'), 'Make the opening shot sharp and bright.', 'utf8');
  await writeFile(path.join(shotRoot, 'frame.png'), 'png-placeholder', 'utf8');
  await writeFile(path.join(shotRoot, 'render.mp4'), 'video-placeholder', 'utf8');

  const runs = await readContentRuns(root);

  assert.equal(runs.length, 1);
  assert.equal(runs[0].title, 'Launch reel');
  assert.equal(runs[0].workspaceKind, 'ai-studio');
  assert.equal(runs[0].workspaceLabel, 'AI Studio');
  assert.equal(runs[0].prompts.length, 1);
  assert.equal(runs[0].nodes.some((node) => node.type === 'prompt'), true);
  assert.deepEqual(
    runs[0].artifacts.map((asset) => asset.name),
    ['frame.png', 'render.mp4'],
  );
  assert.equal(runs[0].artifacts.find((asset) => asset.name === 'render.mp4')?.metadata?.stage, 'video-output');
});

test('preview discovery keeps AI Studio and Reels content runs separated', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-content-workspaces-'));
  const aiStudioRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'studio-job');
  const reelsRoot = path.join(root, 'apps', 'genius-content', 'output', 'pipeline', 'reel-run');

  await mkdir(aiStudioRoot, {recursive: true});
  await mkdir(reelsRoot, {recursive: true});
  await writeFile(path.join(aiStudioRoot, 'prompt.txt'), 'AI Studio prompt', 'utf8');
  await writeFile(path.join(reelsRoot, 'prompt.txt'), 'Reels prompt', 'utf8');

  const runs = await readContentRuns(root);
  const aiStudioRuns = runs.filter((run) => run.workspaceKind === 'ai-studio');
  const reelsRuns = runs.filter((run) => run.workspaceKind === 'reels');

  assert.equal(aiStudioRuns.length, 1);
  assert.equal(reelsRuns.length, 1);
  assert.equal(aiStudioRuns[0].rootPath.includes('/ai-studio/'), true);
  assert.equal(reelsRuns[0].rootPath.includes('/pipeline/'), true);
  assert.equal(aiStudioRuns[0].workspaceLabel, 'AI Studio');
  assert.equal(reelsRuns[0].workspaceLabel, 'Reels');
});

test('preview discovery links generated content runs back to source job prompts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-generated-content-preview-'));
  const jobRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'job-two');
  const generatedRoot = path.join(
    root,
    'apps',
    'genius-content',
    'output',
    'ai-studio',
    'generated',
    'job-two-generated-20260424T100000Z',
  );

  await mkdir(jobRoot, {recursive: true});
  await mkdir(generatedRoot, {recursive: true});
  await writeFile(path.join(jobRoot, 'prompt.txt'), 'Source job prompt', 'utf8');
  await writeFile(path.join(generatedRoot, 'frame.png'), 'image-placeholder', 'utf8');

  const runs = await readContentRuns(root);
  const generatedRun = runs.find((run) => run.rootPath.endsWith('job-two-generated-20260424T100000Z'));

  assert.ok(generatedRun);
  assert.equal(generatedRun.prompts.length, 1);
  assert.equal(generatedRun.prompts[0].bodyPreview, 'Source job prompt');
  assert.equal(generatedRun.nodes.some((node) => node.type === 'prompt'), true);
});

test('preview discovery annotates content render assets for prompt-to-output flow', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-content-flow-preview-'));
  const jobShotRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'flow-job', 'shots', '01-open');
  const generatedShotRoot = path.join(
    root,
    'apps',
    'genius-content',
    'output',
    'ai-studio',
    'generated',
    'flow-job-generated-20260424T120000Z',
    '01-open',
  );

  await mkdir(jobShotRoot, {recursive: true});
  await mkdir(generatedShotRoot, {recursive: true});
  await writeFile(
    path.join(jobShotRoot, 'shot.json'),
    JSON.stringify({shotId: '01-open', cameraAngle: 'low angle handheld close-up'}),
    'utf8',
  );
  await writeFile(path.join(jobShotRoot, 'dialogue.txt'), 'Line used by the shot.', 'utf8');
  await writeFile(path.join(jobShotRoot, 'nano-banana-first.json'), '{"prompt":"first image"}', 'utf8');
  await writeFile(path.join(jobShotRoot, 'veo-request.json'), '{"prompt":"Camera: vertical handheld. video motion"}', 'utf8');
  await writeFile(path.join(generatedShotRoot, '01-open-first.png'), 'image-placeholder', 'utf8');
  await writeFile(path.join(generatedShotRoot, '01-open-trimmed.mp4'), 'video-placeholder', 'utf8');

  const runs = await readContentRuns(root);
  const generatedRun = runs.find((run) => run.rootPath.endsWith('flow-job-generated-20260424T120000Z'));

  assert.ok(generatedRun);
  assert.equal(generatedRun.prompts.length, 4);
  assert.equal(generatedRun.artifacts.length, 2);
  assert.equal(generatedRun.prompts.find((prompt) => prompt.path.endsWith('shot.json'))?.metadata?.stage, 'shot-spec');
  assert.match(generatedRun.prompts.find((prompt) => prompt.path.endsWith('shot.json'))?.bodyPreview ?? '', /low angle/);
  assert.equal(generatedRun.prompts.find((prompt) => prompt.path.endsWith('dialogue.txt'))?.metadata?.stage, 'dialogue');
  assert.match(generatedRun.prompts.find((prompt) => prompt.path.endsWith('veo-request.json'))?.bodyPreview ?? '', /Camera:/);
  assert.equal(generatedRun.artifacts[0].publicUrl?.startsWith('/api/workspace/'), true);
  assert.equal(generatedRun.artifacts.find((asset) => asset.name.endsWith('.mp4'))?.metadata?.stage, 'video-output');
  assert.equal(generatedRun.artifacts.find((asset) => asset.name.endsWith('.png'))?.metadata?.shotId, '01-open');
});

test('preview discovery resolves generated AI Studio frame and video paths back to source prompts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-content-trace-preview-'));
  const jobRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'trace-job');
  const jobShotRoot = path.join(jobRoot, 'shots', '01-open');
  const generatedRoot = path.join(
    root,
    'apps',
    'genius-content',
    'output',
    'ai-studio',
    'generated',
    'trace-job-generated-20260424T130000Z',
  );
  const generatedShotRoot = path.join(generatedRoot, '01-open');

  await mkdir(jobShotRoot, {recursive: true});
  await mkdir(generatedShotRoot, {recursive: true});
  await writeFile(path.join(jobRoot, 'script.json'), '{"beats":[{"shotId":"01-open"}]}', 'utf8');
  await writeFile(path.join(jobShotRoot, 'nano-banana-first.json'), '{"prompt":"first image"}', 'utf8');
  await writeFile(path.join(jobShotRoot, 'nano-banana-last.json'), '{"prompt":"last image"}', 'utf8');
  await writeFile(path.join(jobShotRoot, 'veo-request.json'), '{"prompt":"video","firstFrameInputPath":"shots/01-open/nano-banana-first.json","lastFrameInputPath":"shots/01-open/nano-banana-last.json"}', 'utf8');
  await writeFile(path.join(generatedShotRoot, '01-open-first.png'), 'first-image-placeholder', 'utf8');
  await writeFile(path.join(generatedShotRoot, '01-open-last.png'), 'last-image-placeholder', 'utf8');
  await writeFile(path.join(generatedShotRoot, '01-open-raw.mp4'), 'raw-video-placeholder', 'utf8');
  await writeFile(path.join(generatedShotRoot, '01-open-trimmed.mp4'), 'trimmed-video-placeholder', 'utf8');
  await writeFile(
    path.join(generatedRoot, 'summary.json'),
    JSON.stringify({
      shots: [
        {
          id: '01-open',
          firstFramePath: path.join(generatedShotRoot, '01-open-first.png'),
          lastFramePath: path.join(generatedShotRoot, '01-open-last.png'),
          rawVideoPath: path.join(generatedShotRoot, '01-open-raw.mp4'),
          trimmedVideoPath: path.join(generatedShotRoot, '01-open-trimmed.mp4'),
        },
      ],
    }),
    'utf8',
  );

  const runs = await readContentRuns(root);
  const generatedRun = runs.find((run) => run.rootPath.endsWith('trace-job-generated-20260424T130000Z'));

  assert.ok(generatedRun);
  const firstPrompt = generatedRun.prompts.find((prompt) => prompt.path.endsWith('nano-banana-first.json'));
  const lastPrompt = generatedRun.prompts.find((prompt) => prompt.path.endsWith('nano-banana-last.json'));
  const videoPrompt = generatedRun.prompts.find((prompt) => prompt.path.endsWith('veo-request.json'));
  const scriptPrompt = generatedRun.prompts.find((prompt) => prompt.path.endsWith('script.json'));

  assert.equal(scriptPrompt?.metadata?.shotId, undefined);
  assert.equal(firstPrompt?.metadata?.generatedOutputPath, 'apps/genius-content/output/ai-studio/generated/trace-job-generated-20260424T130000Z/01-open/01-open-first.png');
  assert.equal(lastPrompt?.metadata?.generatedOutputPath, 'apps/genius-content/output/ai-studio/generated/trace-job-generated-20260424T130000Z/01-open/01-open-last.png');
  assert.deepEqual(videoPrompt?.metadata?.runtimeInputs, {
    firstFramePath: 'apps/genius-content/output/ai-studio/generated/trace-job-generated-20260424T130000Z/01-open/01-open-first.png',
    lastFramePath: 'apps/genius-content/output/ai-studio/generated/trace-job-generated-20260424T130000Z/01-open/01-open-last.png',
    rawVideoPath: 'apps/genius-content/output/ai-studio/generated/trace-job-generated-20260424T130000Z/01-open/01-open-raw.mp4',
    trimmedVideoPath: 'apps/genius-content/output/ai-studio/generated/trace-job-generated-20260424T130000Z/01-open/01-open-trimmed.mp4',
  });
});

test('preview discovery keeps long render prompts available for canvas inspection', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-long-prompt-preview-'));
  const shotRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'long-job', 'shots', '01-open');
  const longCameraPrompt = `Camera: locked vertical close-up.\n${'prompt detail '.repeat(360)}`;

  await mkdir(shotRoot, {recursive: true});
  await writeFile(path.join(shotRoot, 'veo-request.json'), JSON.stringify({prompt: longCameraPrompt}), 'utf8');

  const runs = await readContentRuns(root);
  const videoPrompt = runs[0].prompts.find((prompt) => prompt.path.endsWith('veo-request.json'));

  assert.ok(videoPrompt);
  assert.match(videoPrompt.bodyPreview, /Camera: locked vertical close-up/);
  assert.equal(videoPrompt.bodyPreview.includes('...'), false);
  assert.ok(videoPrompt.bodyPreview.length > 3500);
});

test('preview discovery reads brains runs with videos, comments, and artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-brains-preview-'));
  const runRoot = path.join(root, 'apps', 'genius-brains', 'output', 'brain-job');

  await mkdir(runRoot, {recursive: true});
  await writeFile(path.join(runRoot, 'job.json'), JSON.stringify({title: 'Audience scan'}), 'utf8');
  await writeFile(path.join(runRoot, 'videos.json'), JSON.stringify([{videoId: 'v1', title: 'Main video', views: 100}]), 'utf8');
  await writeFile(
    path.join(runRoot, 'comments.scored.json'),
    JSON.stringify([{author: 'Ana', text: 'Strong hook', score: 92, likes: 12}]),
    'utf8',
  );
  await writeFile(path.join(runRoot, 'flow.md'), 'Brains flow notes', 'utf8');

  const runs = await readBrainsRuns(root);

  assert.equal(runs.length, 1);
  assert.equal(runs[0].title, 'Audience scan');
  assert.equal(runs[0].videos[0].title, 'Main video');
  assert.equal(runs[0].comments[0].text, 'Strong hook');
  assert.equal(runs[0].artifacts[0].name, 'flow.md');
});

test('preview discovery reads nested brains comments from scored video payloads', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-brains-nested-comments-'));
  const runRoot = path.join(root, 'apps', 'genius-brains', 'output', 'nested-brain-job');

  await mkdir(runRoot, {recursive: true});
  await writeFile(
    path.join(runRoot, 'comments.scored.json'),
    JSON.stringify({
      videos: [
        {
          title: 'Nested video',
          comments: [{author: 'Marta', text: 'Nested signal', engagementScore: 41, likeCount: 7}],
        },
      ],
    }),
    'utf8',
  );

  const runs = await readBrainsRuns(root);

  assert.equal(runs[0].comments.length, 1);
  assert.equal(runs[0].comments[0].text, 'Nested signal');
  assert.equal(runs[0].comments[0].likeCount, 7);
});

test('preview asset library skips video files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-assets-preview-'));
  const outputRoot = path.join(root, 'apps', 'genius-content', 'output', 'renders');

  await mkdir(outputRoot, {recursive: true});
  await writeFile(path.join(outputRoot, 'frame.webp'), 'image-placeholder', 'utf8');
  await writeFile(path.join(outputRoot, 'clip.mp4'), 'video-placeholder', 'utf8');

  const library = await readPreviewAssets(root);

  assert.equal(library.assets.length, 1);
  assert.equal(library.assets[0].name, 'frame.webp');
});

test('createCanvasConfig keeps explicit overrides intact', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'canvas-config-'));
  const packageRoot = path.join(workspaceRoot, 'custom-package');
  const publicRoot = path.join(packageRoot, 'public');
  const analysisRoot = path.join(workspaceRoot, 'custom-analysis');
  const videoRoot = path.join(workspaceRoot, 'custom-video');
  const scaleCalendarPath = path.join(workspaceRoot, 'custom-scale-calendar.json');

  await mkdir(publicRoot, {recursive: true});

  const config = createCanvasConfig({
    workspaceRoot,
    packageRoot,
    publicRoot,
    analysisRoot,
    videoRoot,
    scaleCalendarPath,
    port: 4321,
  });

  assert.equal(config.packageRoot, packageRoot);
  assert.equal(config.publicRoot, publicRoot);
  assert.equal(config.analysisRoot, analysisRoot);
  assert.equal(config.videoRoot, videoRoot);
  assert.equal(config.scaleCalendarPath, scaleCalendarPath);
  assert.equal(config.port, 4321);
});

test('readScaleCalendar returns an empty calendar when the file is missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-scale-calendar-'));
  const missing = path.join(root, 'calendar.json');

  const calendar = await readScaleCalendar(missing);

  assert.deepEqual(calendar, {generatedAt: null, entries: []});
});

test('readScaleCalendar rejects calendar JSON with the wrong shape', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-scale-calendar-invalid-'));
  const calendarPath = path.join(root, 'calendar.json');

  await writeFile(calendarPath, JSON.stringify({generatedAt: '2026-04-24T10:00:00.000Z', entries: [{}]}), 'utf8');

  await assert.rejects(
    () => readScaleCalendar(calendarPath),
    /Invalid scale calendar: entries\[0\]\.id must be a string/,
  );
});

test('createCanvasServer serves scale calendar JSON', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-scale-calendar-server-'));
  const calendarPath = path.join(root, 'calendar.json');
  const calendar = {
    generatedAt: '2026-04-24T10:00:00.000Z',
    entries: [
      {
        id: 'item-1',
        projectId: 'gaclight',
        projectName: 'G@CLight',
        platforms: ['threads'],
        scheduledAt: '2026-04-25T10:00:00.000Z',
        timezone: 'Europe/Warsaw',
        status: 'ready',
        title: 'Publish canvas scale',
        bodyPreview: 'Hello from Threads',
        source: {type: 'manual', path: 'input/content/item.json'},
        assets: [],
      },
    ],
  } satisfies ScaleCalendar;

  await writeFile(calendarPath, JSON.stringify(calendar), 'utf8');

  const server = createCanvasServer(
    createCanvasConfig({
      workspaceRoot: root,
      publicRoot: root,
      analysisRoot: root,
      videoRoot: root,
      scaleCalendarPath: calendarPath,
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/scale-calendar`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await response.json(), calendar);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('createCanvasServer serves preview-only canvas datasets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-preview-server-'));
  const contentRoot = path.join(root, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs', 'job-one');
  const brainsRoot = path.join(root, 'apps', 'genius-brains', 'output', 'brain-job');
  const calendarPath = path.join(root, 'apps', 'genius-scale', 'output', 'calendar.json');

  await mkdir(contentRoot, {recursive: true});
  await mkdir(brainsRoot, {recursive: true});
  await mkdir(path.dirname(calendarPath), {recursive: true});
  await writeFile(path.join(contentRoot, 'prompt.txt'), 'Content prompt', 'utf8');
  await writeFile(path.join(contentRoot, 'frame.png'), 'image-placeholder', 'utf8');
  await writeFile(path.join(contentRoot, 'clip.mp4'), 'video-placeholder', 'utf8');
  await writeFile(path.join(brainsRoot, 'videos.json'), JSON.stringify([{title: 'Source video'}]), 'utf8');
  await writeFile(path.join(brainsRoot, 'comments.raw.json'), JSON.stringify([{text: 'Needs a sharper CTA'}]), 'utf8');
  await writeFile(calendarPath, JSON.stringify({generatedAt: null, entries: []}), 'utf8');

  const server = createCanvasServer(
    createCanvasConfig({
      workspaceRoot: root,
      publicRoot: root,
      analysisRoot: root,
      videoRoot: root,
      scaleCalendarPath: calendarPath,
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const contentResponse = await fetch(`${baseUrl}/api/content-runs`);
    const brainsResponse = await fetch(`${baseUrl}/api/brains-runs`);
    const viralBrainsResponse = await fetch(`${baseUrl}/api/genius-brains`);
    const assetsResponse = await fetch(`${baseUrl}/api/assets`);

    assert.equal(contentResponse.status, 200);
    assert.equal(brainsResponse.status, 200);
    assert.equal(viralBrainsResponse.status, 200);
    assert.equal(assetsResponse.status, 200);

    const contentRuns = (await contentResponse.json()) as unknown[];
    const brainsRuns = (await brainsResponse.json()) as unknown[];
    const viralBrains = (await viralBrainsResponse.json()) as {runs: unknown[]; candidates: unknown[]};
    const assetLibrary = (await assetsResponse.json()) as {assets: Array<{name: string}>};

    assert.equal(contentRuns.length, 1);
    assert.equal(brainsRuns.length, 1);
    assert.deepEqual(viralBrains, {generatedAt: viralBrains.generatedAt, runs: [], candidates: [], reports: []});
    assert.deepEqual(
      assetLibrary.assets.map((asset) => asset.name).sort(),
      ['comments.raw.json', 'frame.png', 'prompt.txt', 'videos.json'],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('createCanvasServer returns 500 for corrupt scale calendar JSON', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-scale-calendar-corrupt-server-'));
  const calendarPath = path.join(root, 'calendar.json');

  await writeFile(calendarPath, '{"generatedAt":', 'utf8');

  const server = createCanvasServer(
    createCanvasConfig({
      workspaceRoot: root,
      publicRoot: root,
      analysisRoot: root,
      videoRoot: root,
      scaleCalendarPath: calendarPath,
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/scale-calendar`);

    assert.equal(response.status, 500);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('createCanvasServer returns 500 for wrong-shape scale calendar JSON', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-scale-calendar-invalid-server-'));
  const calendarPath = path.join(root, 'calendar.json');

  await writeFile(calendarPath, JSON.stringify({generatedAt: null, entries: [{id: 'item-1'}]}), 'utf8');

  const server = createCanvasServer(
    createCanvasConfig({
      workspaceRoot: root,
      publicRoot: root,
      analysisRoot: root,
      videoRoot: root,
      scaleCalendarPath: calendarPath,
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/scale-calendar`);

    assert.equal(response.status, 500);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('viral dashboard read model exposes persisted comments, transcripts and analyses', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-viral-dashboard-'));
  const database = new DatabaseSync(path.join(root, 'brains.sqlite'));
  database.exec(`
    CREATE TABLE runs (id TEXT, status TEXT, analysis_status TEXT, started_at TEXT, finished_at TEXT, spent_credits INTEGER, error_summary TEXT, created_at TEXT);
    CREATE TABLE candidates (id TEXT, run_id TEXT, platform TEXT, language TEXT, subtopic TEXT, source_query TEXT, source_url TEXT, content_type TEXT, text TEXT, published_at TEXT, metrics TEXT, discovery_score REAL, final_score REAL, score_components TEXT, enrichment_status TEXT);
    CREATE TABLE comments (candidate_id TEXT, platform_comment_id TEXT, author TEXT, text TEXT, likes INTEGER);
    CREATE TABLE transcripts (candidate_id TEXT, text TEXT, language TEXT, confidence REAL, status TEXT);
    CREATE TABLE reports (run_id TEXT, report_type TEXT, markdown_path TEXT, json_path TEXT);
  `);
  database.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('run-1', 'complete', 'complete', '2026-09-20T10:00:00Z', '2026-09-20T10:01:00Z', 18, null, '2026-09-20T10:00:00Z');
  database.prepare('INSERT INTO candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('instagram:1', 'run-1', 'instagram', 'en', 'AI agents', 'AI agents', 'https://instagram.com/reel/1', 'reel', 'Build agents', '2026-09-20T09:00:00Z', JSON.stringify({views: 1000, likes: 50, comments: 12}), 88, 92, JSON.stringify({velocity: 0.9}), 'enriched');
  database.prepare('INSERT INTO comments VALUES (?, ?, ?, ?, ?)').run('instagram:1', 'comment-1', 'viewer', 'How did you build it?', 9);
  database.prepare('INSERT INTO transcripts VALUES (?, ?, ?, ?, ?)').run('instagram:1', 'Build an agent in three steps.', 'en', 0.94, 'complete');
  database.prepare('INSERT INTO reports VALUES (?, ?, ?, ?)').run('run-1', 'viral-intelligence', 'run-1/reports/report.md', 'run-1/reports/report.json');
  database.close();
  await mkdir(path.join(root, 'run-1', 'analysis', 'items'), {recursive: true});
  await writeFile(path.join(root, 'run-1', 'analysis', 'items', 'instagram-1.json'), JSON.stringify({summary: 'Specific workflow.'}), 'utf8');
  await mkdir(path.join(root, 'run-1', 'reports'), {recursive: true});
  await writeFile(path.join(root, 'run-1', 'reports', 'report.json'), JSON.stringify({synthesis: {recommendations: ['Show the workflow.']}}), 'utf8');

  const dashboard = await readViralBrainsDashboard(root);
  assert.equal(dashboard.runs[0].id, 'run-1');
  assert.equal(dashboard.candidates[0].transcript?.confidence, 0.94);
  assert.equal(dashboard.candidates[0].comments[0].text, 'How did you build it?');
  assert.equal(dashboard.candidates[0].analysis?.summary, 'Specific workflow.');
  assert.equal(dashboard.reports[0].document?.synthesis && typeof dashboard.reports[0].document?.synthesis, 'object');
});
test('reel catalog migrates saved engine settings, serves only Hyperframes exports and rejects removed engines', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-hyperframes-only-'));
  const reels = path.join(root,'apps/genius-content/reels');
  const renders = path.join(root,'apps/genius-content/output/renders');
  await mkdir(reels,{recursive:true});
  await mkdir(renders,{recursive:true});
  const legacy={id:'saved-project',title:'Saved edit',preferredEngine:'remotion',clips:[{start:0,end:2}],scenes:[]};
  const migrated={...legacy,preferredEngine:'hyperframes'};
  await writeFile(path.join(reels,'saved-project.json'),JSON.stringify(legacy));
  for(const engine of ['remotion','hyperframes']) {
    await writeFile(path.join(renders,`saved-project-${engine}.mp4`),'video-placeholder');
    await writeFile(path.join(renders,`saved-project-${engine}.json`),JSON.stringify({engine,reel:engine==='hyperframes'?migrated:legacy}));
  }
  const server=createCanvasServer(createCanvasConfig({workspaceRoot:root,publicRoot:root,analysisRoot:root,videoRoot:root}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const address=server.address();
    assert.ok(address && typeof address==='object');
    const base=`http://127.0.0.1:${address.port}`;
    const catalog=await fetch(`${base}/api/reels`).then(r=>r.json());
    assert.equal(catalog.reels[0].preferredEngine,'hyperframes');
    assert.deepEqual(catalog.reels[0].clips,legacy.clips);
    assert.equal(catalog.reels[0].outputs.length,1);
    assert.equal(catalog.reels[0].outputs[0].engine,'hyperframes');
    assert.equal(catalog.reels[0].outputs[0].stale,false);
    const rejected=await fetch(`${base}/api/reels/saved-project/render`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engine:'remotion'})});
    assert.equal(rejected.status,400);
    assert.equal((await fetch(`${base}/api/reels`).then(r=>r.json())).jobs.length,0);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
