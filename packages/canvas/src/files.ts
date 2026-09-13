import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';

import type {
  AnalysisListEntry,
  BrainsCommentPreview,
  BrainsRunPreview,
  BrainsVideoPreview,
  CanvasAssetLibrary,
  CanvasAssetPreview,
  CanvasPreviewNode,
  CanvasPromptPreview,
  ContentRunPreview,
  ScaleCalendar,
} from './types.js';

const RAW_ANALYSIS_SUFFIXES = ['-raw.json', '-google-raw.json', '-firecrawl-raw.json'];
const TEXT_PREVIEW_LIMIT = 20000;
const ASSET_SCAN_LIMIT = 300;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.mpg', '.mpeg']);
const ASSET_EXTENSIONS = new Set(['.css', '.html', '.jpeg', '.jpg', '.json', '.md', '.png', '.txt', '.webp']);
const CONTENT_RUN_ASSET_EXTENSIONS = new Set([...ASSET_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const PROMPT_FILE_NAMES = new Set([
  'prompt.txt',
  'shot.json',
  'dialogue.txt',
  'nano-banana-first.json',
  'nano-banana-last.json',
  'veo-request.json',
  'preview-prompt.md',
  'scene-contract.json',
  'script.json',
  'edit-brief.md',
  'flow.md',
  'personas.json',
  'scene-rationale.md',
  'audio-notes.md',
  'character-anchor.md',
]);
const RUN_METADATA_FILE_NAMES = new Set(['job.json', 'videos.json', 'comments.scored.json', 'comments.raw.json']);
const GLOBAL_METADATA_FILE_NAMES = new Set(['calendar.json']);
const CONTENT_OUTPUT_ROOTS = [
  ['apps', 'genius-content', 'output', 'ai-studio', 'jobs'],
  ['apps', 'genius-content', 'output', 'ai-studio', 'generated'],
  ['apps', 'genius-content', 'output', 'pipeline'],
];
const ASSET_OUTPUT_ROOTS = [
  ['apps', 'genius-content', 'output'],
  ['apps', 'genius-brains', 'output'],
  ['apps', 'genius-scale', 'output'],
];
const REQUIRED_SCALE_CALENDAR_STRING_FIELDS = [
  'id',
  'projectId',
  'projectName',
  'scheduledAt',
  'timezone',
  'status',
  'title',
  'bodyPreview',
];

export const contentTypes: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

export const listAnalysisEntries = async (analysisRoot: string): Promise<AnalysisListEntry[]> => {
  try {
    const entries = await readdir(analysisRoot);
    const jsonFiles = entries.filter(
      (entry) =>
        entry.endsWith('.json') &&
        !RAW_ANALYSIS_SUFFIXES.some((suffix) => entry.endsWith(suffix)),
    );

    const enriched = await Promise.all(
      jsonFiles.map(async (name) => {
        const fullPath = path.join(analysisRoot, name);
        const fileStat = await stat(fullPath);
        return {
          name,
          updatedAt: fileStat.mtimeMs,
        };
      }),
    );

    return enriched.sort((left, right) => right.updatedAt - left.updatedAt);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

export const readResponseBody = async (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  return {
    body: await readFile(filePath),
    contentType: contentTypes[extension] ?? 'application/octet-stream',
  };
};

export const readContentRuns = async (workspaceRoot: string): Promise<ContentRunPreview[]> => {
  const runs: ContentRunPreview[] = [];
  const jobsRoot = path.join(workspaceRoot, 'apps', 'genius-content', 'output', 'ai-studio', 'jobs');

  for (const rootSegments of CONTENT_OUTPUT_ROOTS) {
    const workspaceKind = rootSegments.includes('pipeline') ? 'reels' : 'ai-studio';
    const workspaceLabel = workspaceKind === 'reels' ? 'Reels' : 'AI Studio';
    const outputRoot = path.join(workspaceRoot, ...rootSegments);
    const entries = await safeReadDirents(outputRoot);

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const runRoot = path.join(outputRoot, entry.name);
      const metadata = await inferRunMetadata(runRoot);
      let prompts = await readPromptFiles(workspaceRoot, runRoot);
      if (prompts.length === 0 && rootSegments.includes('generated')) {
        const sourceJobName = entry.name.replace(/-generated-.+$/u, '').replace(/-preview-refs$/u, '');
        const sourceJobRoot = path.join(jobsRoot, sourceJobName);
        if (await pathExists(sourceJobRoot)) {
          const generatedTrace = await readGeneratedRunTrace(workspaceRoot, runRoot);
          prompts = (await readPromptFiles(workspaceRoot, sourceJobRoot)).map((prompt) => ({
            ...prompt,
            metadata: {
              ...(prompt.metadata ?? {}),
              sourceRunPath: toWorkspacePath(workspaceRoot, sourceJobRoot),
              ...getGeneratedPromptTrace(prompt, generatedTrace),
            },
          }));
        }
      }
      const artifacts = await readRunAssets(workspaceRoot, runRoot);
      const runStat = await stat(runRoot);
      const id = toWorkspacePath(workspaceRoot, runRoot);
      const status = getString(metadata, ['status', 'state'], prompts.length > 0 || artifacts.length > 0 ? 'preview' : 'empty');
      const title = getString(metadata, ['title', 'name', 'jobId', 'id'], entry.name);
      const rootPath = toWorkspacePath(workspaceRoot, runRoot);
      const run: ContentRunPreview = {
        id,
        title,
        status,
        workspaceKind,
        workspaceLabel,
        updatedAt: runStat.mtimeMs,
        rootPath,
        nodes: [],
        prompts,
        artifacts,
      };
      run.nodes = buildContentNodes(run, prompts, artifacts);
      runs.push(run);
    }
  }

  return runs.sort((left, right) => right.updatedAt - left.updatedAt);
};

const normalizeVideos = (value: unknown): BrainsVideoPreview[] => {
  const items = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.videos) ? value.videos : [];

  return items.filter(isRecord).slice(0, 16).map((item, index) => ({
    videoId: getString(item, ['videoId', 'id'], `video-${index + 1}`),
    title: getString(item, ['title', 'name'], `Video ${index + 1}`),
    viewCount: getNumber(item, ['viewCount', 'views']),
    commentCount: getNumber(item, ['commentCount', 'comments']),
    status: typeof item.status === 'string' ? item.status : undefined,
  }));
};

const normalizeComments = (value: unknown): BrainsCommentPreview[] => {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.comments)
      ? value.comments
      : isRecord(value) && Array.isArray(value.items)
        ? value.items
        : isRecord(value) && Array.isArray(value.videos)
          ? value.videos.filter(isRecord).flatMap((video) => (Array.isArray(video.comments) ? video.comments : []))
        : [];

  return items.filter(isRecord).slice(0, 40).map((item) => ({
    author: typeof item.author === 'string' ? item.author : typeof item.channelTitle === 'string' ? item.channelTitle : undefined,
    text: getString(item, ['text', 'comment', 'body'], ''),
    engagementScore: getNumber(item, ['engagementScore', 'score']),
    likeCount: getNumber(item, ['likeCount', 'likes']),
    replyCount: getNumber(item, ['replyCount', 'replies']),
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : typeof item.url === 'string' ? item.url : undefined,
    whySelected: typeof item.whySelected === 'string' ? item.whySelected : undefined,
  })).filter((comment) => comment.text.length > 0);
};

export const readBrainsRuns = async (workspaceRoot: string): Promise<BrainsRunPreview[]> => {
  const outputRoot = path.join(workspaceRoot, 'apps', 'genius-brains', 'output');
  const entries = await safeReadDirents(outputRoot);
  const runs: BrainsRunPreview[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const runRoot = path.join(outputRoot, entry.name);
    const metadata = await inferRunMetadata(runRoot);
    const videos = normalizeVideos(await readJsonIfExists(path.join(runRoot, 'videos.json')));
    const scoredComments = await readJsonIfExists(path.join(runRoot, 'comments.scored.json'));
    const rawComments = await readJsonIfExists(path.join(runRoot, 'comments.raw.json'));
    const comments = normalizeComments(scoredComments ?? rawComments);
    const artifacts = await readRunAssets(workspaceRoot, runRoot);
    const runStat = await stat(runRoot);

    runs.push({
      id: toWorkspacePath(workspaceRoot, runRoot),
      title: getString(metadata, ['title', 'name', 'jobId', 'id'], entry.name),
      status: getString(metadata, ['status', 'state'], comments.length > 0 || videos.length > 0 ? 'preview' : 'empty'),
      updatedAt: runStat.mtimeMs,
      rootPath: toWorkspacePath(workspaceRoot, runRoot),
      videos,
      comments,
      artifacts,
    });
  }

  return runs.sort((left, right) => right.updatedAt - left.updatedAt);
};

export const readPreviewAssets = async (workspaceRoot: string): Promise<CanvasAssetLibrary> => {
  const files: string[] = [];

  for (const rootSegments of ASSET_OUTPUT_ROOTS) {
    const outputRoot = path.join(workspaceRoot, ...rootSegments);
    files.push(
      ...(await collectFiles(
        outputRoot,
        (filePath) => isPreviewAsset(filePath) && !GLOBAL_METADATA_FILE_NAMES.has(path.basename(filePath)),
        Math.max(ASSET_SCAN_LIMIT - files.length, 0),
      )),
    );
    if (files.length >= ASSET_SCAN_LIMIT) {
      break;
    }
  }

  const assets = await Promise.all(files.slice(0, ASSET_SCAN_LIMIT).map((filePath) => createAssetPreview(workspaceRoot, filePath)));

  return {
    generatedAt: new Date().toISOString(),
    assets: assets.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0)),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeReadDir = async (dirPath: string, options?: {withFileTypes?: false}) => {
  try {
    return await readdir(dirPath, options);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const safeReadDirents = async (dirPath: string) => {
  try {
    return await readdir(dirPath, {withFileTypes: true});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const pathExists = async (filePath: string) => {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const toWorkspacePath = (workspaceRoot: string, filePath: string) =>
  path.relative(workspaceRoot, filePath).split(path.sep).join('/');

const truncateText = (value: string, limit = TEXT_PREVIEW_LIMIT) =>
  value.length > limit ? `${value.slice(0, limit).trimEnd()}\n...` : value;

const getString = (record: Record<string, unknown>, fields: string[], fallback: string) => {
  for (const field of fields) {
    if (typeof record[field] === 'string' && record[field].trim().length > 0) {
      return record[field];
    }
  }

  return fallback;
};

const getNumber = (record: Record<string, unknown>, fields: string[]) => {
  for (const field of fields) {
    if (typeof record[field] === 'number') {
      return record[field];
    }
  }

  return undefined;
};

const readJsonIfExists = async (filePath: string): Promise<unknown | null> => {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
};

const normalizeTracePath = (workspaceRoot: string, value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const normalizedValue = path.normalize(value);
  const normalizedRoot = path.normalize(workspaceRoot);
  if (path.isAbsolute(normalizedValue) && normalizedValue.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
    return toWorkspacePath(workspaceRoot, normalizedValue);
  }

  return value.split(path.sep).join('/');
};

interface GeneratedShotTrace {
  firstFramePath?: string;
  lastFramePath?: string;
  rawVideoPath?: string;
  trimmedVideoPath?: string;
}

const readGeneratedRunTrace = async (workspaceRoot: string, runRoot: string): Promise<Map<string, GeneratedShotTrace>> => {
  const summary = await readJsonIfExists(path.join(runRoot, 'summary.json'));
  const shots = isRecord(summary) && Array.isArray(summary.shots) ? summary.shots : [];
  const trace = new Map<string, GeneratedShotTrace>();

  shots.filter(isRecord).forEach((shot) => {
    const id = typeof shot.id === 'string' ? shot.id : typeof shot.shotId === 'string' ? shot.shotId : undefined;
    if (!id) {
      return;
    }

    trace.set(id, {
      firstFramePath: normalizeTracePath(workspaceRoot, shot.firstFramePath),
      lastFramePath: normalizeTracePath(workspaceRoot, shot.lastFramePath),
      rawVideoPath: normalizeTracePath(workspaceRoot, shot.rawVideoPath),
      trimmedVideoPath: normalizeTracePath(workspaceRoot, shot.trimmedVideoPath),
    });
  });

  return trace;
};

const getGeneratedPromptTrace = (
  prompt: CanvasPromptPreview,
  generatedTrace: Map<string, GeneratedShotTrace>,
): Record<string, unknown> => {
  const shotId = typeof prompt.metadata?.shotId === 'string' ? prompt.metadata.shotId : undefined;
  const fileName = typeof prompt.metadata?.fileName === 'string' ? prompt.metadata.fileName : '';
  const trace = shotId ? generatedTrace.get(shotId) : undefined;
  if (!trace) {
    return {};
  }

  if (fileName === 'nano-banana-first.json') {
    return {generatedOutputPath: trace.firstFramePath};
  }
  if (fileName === 'nano-banana-last.json') {
    return {generatedOutputPath: trace.lastFramePath};
  }
  if (fileName === 'veo-request.json') {
    return {
      runtimeInputs: {
        firstFramePath: trace.firstFramePath,
        lastFramePath: trace.lastFramePath,
        rawVideoPath: trace.rawVideoPath,
        trimmedVideoPath: trace.trimmedVideoPath,
      },
    };
  }

  return {};
};

const readTextPreview = async (filePath: string) => truncateText(await readFile(filePath, 'utf8'));

const isVideoFile = (filePath: string) => VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const isPreviewAsset = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  return ASSET_EXTENSIONS.has(extension) && !isVideoFile(filePath);
};

const isContentRunAsset = (filePath: string) => CONTENT_RUN_ASSET_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const inferShotId = (filePath: string) => path.basename(path.dirname(filePath));

const inferAssetStage = (filePath: string) => {
  const fileName = path.basename(filePath).toLowerCase();
  if (isVideoFile(filePath)) {
    return fileName.includes('raw') ? 'video-raw-output' : 'video-output';
  }
  if (fileName.includes('first')) {
    return 'image-first-output';
  }
  if (fileName.includes('last')) {
    return 'image-last-output';
  }
  if (/\.(png|jpe?g|webp)$/u.test(fileName)) {
    return 'image-output';
  }
  return 'artifact';
};

const createAssetPreview = async (
  workspaceRoot: string,
  filePath: string,
  metadata: Record<string, unknown> = {},
): Promise<CanvasAssetPreview> => {
  const fileStat = await stat(filePath);
  const workspacePath = toWorkspacePath(workspaceRoot, filePath);
  const extension = path.extname(filePath).toLowerCase().replace('.', '') || 'file';

  return {
    id: workspacePath,
    name: path.basename(filePath),
    type: extension,
    path: workspacePath,
    sizeBytes: fileStat.size,
    updatedAt: fileStat.mtimeMs,
    publicUrl: `/api/workspace/${workspacePath.split('/').map(encodeURIComponent).join('/')}`,
    metadata,
  };
};

const collectFiles = async (rootPath: string, predicate: (filePath: string) => boolean, limit = ASSET_SCAN_LIMIT) => {
  const results: string[] = [];
  const visit = async (currentPath: string) => {
    if (results.length >= limit) {
      return;
    }

    const entries = await safeReadDirents(currentPath);
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        results.push(fullPath);
      }

      if (results.length >= limit) {
        return;
      }
    }
  };

  await visit(rootPath);
  return results;
};

const normalizePromptKind = (fileName: string) => fileName.replace(/\.(json|md|txt)$/i, '').replace(/[-_]+/g, ' ');

const inferPromptStage = (fileName: string) => {
  if (fileName.includes('nano-banana')) {
    return 'image-prompt';
  }
  if (fileName === 'veo-request.json') {
    return 'video-prompt';
  }
  if (fileName === 'prompt.txt') {
    return 'shot-prompt';
  }
  if (fileName === 'shot.json') {
    return 'shot-spec';
  }
  if (fileName === 'dialogue.txt') {
    return 'dialogue';
  }
  if (fileName === 'preview-prompt.md') {
    return 'preview-prompt';
  }
  if (fileName === 'scene-contract.json') {
    return 'scene-contract';
  }
  if (fileName === 'script.json') {
    return 'script';
  }
  if (fileName === 'edit-brief.md') {
    return 'edit-brief';
  }
  if (fileName === 'flow.md') {
    return 'flow';
  }
  if (fileName === 'personas.json') {
    return 'personas';
  }
  return 'context';
};

const createPromptPreview = async (workspaceRoot: string, filePath: string): Promise<CanvasPromptPreview> => {
  const fileName = path.basename(filePath);
  const parentDir = path.basename(path.dirname(filePath));
  const grandParentDir = path.basename(path.dirname(path.dirname(filePath)));
  return {
    id: toWorkspacePath(workspaceRoot, filePath),
    title: normalizePromptKind(fileName),
    kind: path.extname(fileName).toLowerCase().replace('.', '') || 'text',
    path: toWorkspacePath(workspaceRoot, filePath),
    bodyPreview: await readTextPreview(filePath),
    metadata: {
      fileName,
      shotId: grandParentDir === 'shots' ? parentDir : undefined,
      stage: inferPromptStage(fileName),
    },
  };
};

const readPromptFiles = async (workspaceRoot: string, runRoot: string) => {
  const promptFiles = await collectFiles(runRoot, (filePath) => PROMPT_FILE_NAMES.has(path.basename(filePath)), 80);
  return Promise.all(promptFiles.map((filePath) => createPromptPreview(workspaceRoot, filePath)));
};

const readRunAssets = async (workspaceRoot: string, runRoot: string) => {
  const isContentRunRoot = runRoot.split(path.sep).includes('genius-content');
  const assetFiles = await collectFiles(
    runRoot,
    (filePath) =>
      isContentRunAsset(filePath) &&
      !(isContentRunRoot && PROMPT_FILE_NAMES.has(path.basename(filePath))) &&
      !RUN_METADATA_FILE_NAMES.has(path.basename(filePath)),
    80,
  );
  return Promise.all(
    assetFiles.map((filePath) =>
      createAssetPreview(workspaceRoot, filePath, {
        shotId: inferShotId(filePath),
        stage: inferAssetStage(filePath),
        isVideo: isVideoFile(filePath),
      }),
    ),
  );
};

const inferRunMetadata = async (runRoot: string) => {
  const metadata = await readJsonIfExists(path.join(runRoot, 'job.json'));
  return isRecord(metadata) ? metadata : {};
};

const buildContentNodes = (
  run: Pick<ContentRunPreview, 'id' | 'title' | 'rootPath' | 'status'>,
  prompts: CanvasPromptPreview[],
  artifacts: CanvasAssetPreview[],
): CanvasPreviewNode[] => [
  {
    id: `${run.id}:source`,
    label: run.title,
    app: 'content',
    type: 'job',
    status: run.status,
    summary: 'Job/run root detected for Genius@Content preview.',
    sourcePath: run.rootPath,
  },
  ...prompts.map((prompt, index) => ({
    id: `${run.id}:prompt:${index}`,
    label: prompt.title,
    app: 'content' as const,
    type: 'prompt',
    status: 'preview',
    summary: truncateText(prompt.bodyPreview, 240),
    sourcePath: prompt.path,
  })),
  ...artifacts.slice(0, 8).map((asset, index) => ({
    id: `${run.id}:asset:${index}`,
    label: asset.name,
    app: 'content' as const,
    type: 'artifact',
    status: 'ready',
    summary: `${asset.type.toUpperCase()} asset available for preview.`,
    outputPath: asset.path,
  })),
];

const assertScaleCalendar: (value: unknown) => asserts value is ScaleCalendar = (value) => {
  if (!isRecord(value)) {
    throw new Error('Invalid scale calendar: root must be an object');
  }

  if (typeof value.generatedAt !== 'string' && value.generatedAt !== null) {
    throw new Error('Invalid scale calendar: generatedAt must be a string or null');
  }

  if (!Array.isArray(value.entries)) {
    throw new Error('Invalid scale calendar: entries must be an array');
  }

  value.entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid scale calendar: entries[${index}] must be an object`);
    }

    for (const field of REQUIRED_SCALE_CALENDAR_STRING_FIELDS) {
      if (typeof entry[field] !== 'string') {
        throw new Error(`Invalid scale calendar: entries[${index}].${field} must be a string`);
      }
    }

    if (!Array.isArray(entry.platforms)) {
      throw new Error(`Invalid scale calendar: entries[${index}].platforms must be an array`);
    }

    if (!isRecord(entry.source)) {
      throw new Error(`Invalid scale calendar: entries[${index}].source must be an object`);
    }

    if (!Array.isArray(entry.assets)) {
      throw new Error(`Invalid scale calendar: entries[${index}].assets must be an array`);
    }
  });
};

export const readScaleCalendar = async (calendarPath: string): Promise<ScaleCalendar> => {
  try {
    const calendar = JSON.parse(await readFile(calendarPath, 'utf8')) as unknown;
    assertScaleCalendar(calendar);
    return calendar;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {generatedAt: null, entries: []};
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid scale calendar JSON: ${error.message}`);
    }

    if (error instanceof Error && /scale calendar/i.test(error.message)) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read scale calendar: ${error.message}`);
    }

    throw error;
  }
};
