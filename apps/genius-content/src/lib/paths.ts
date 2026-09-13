import {mkdir, stat, writeFile, copyFile, access} from 'node:fs/promises';
import path from 'node:path';
import {resolveContentRoot} from './app-root.js';

const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const getVideoId = (inputPath: string): string => {
  const base = path.parse(inputPath).name;
  return slugify(base) || 'video';
};

export const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, {recursive: true});
};

export const resolveAnalysisPath = (videoId: string) =>
  resolveContentRoot('output', 'analysis', `${videoId}.json`);

export const resolveRenderPath = (videoId: string) =>
  resolveContentRoot('output', 'renders', `${videoId}.mp4`);

export const resolveGoogleRawPath = (videoId: string) =>
  resolveContentRoot('output', 'analysis', `${videoId}-google-raw.json`);

export const resolveFirecrawlRawPath = (videoId: string) =>
  resolveContentRoot('output', 'analysis', `${videoId}-firecrawl-raw.json`);

export const resolveWhisperRawPath = (videoId: string) =>
  resolveContentRoot('output', 'analysis', `${videoId}-whisper-raw.json`);

export const resolveResearchAssetDir = (videoId: string) =>
  resolveContentRoot('output', 'research', videoId);

export const resolvePublicResearchAssetDir = (videoId: string) =>
  resolveContentRoot('public', 'research', videoId);

export const resolvePipelineStageDir = (videoId: string) =>
  resolveContentRoot('output', 'pipeline', videoId);

export const resolveTranscriptCleanPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '00-transcript-clean.json');

export const resolveTranscriptAnalysisPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '01-transcript-analysis.json');

export const resolveResearchPlanPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '02-research-plan.json');

export const resolveEvidencePlanPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '02-evidence-plan.json');

export const resolveResearchBriefPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '03-research-plan.json');

export const resolveAssetAnalysisPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '04-asset-analysis.json');

export const resolveSceneDesignPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '05-scene-design.json');

export const resolveVideoDirectionPath = (videoId: string) =>
  path.resolve(resolvePipelineStageDir(videoId), '06-video-direction.json');

export const resolveChoreographyPath = (videoId: string) =>
  resolveContentRoot('output', 'choreography', `${videoId}.json`);

export const resolvePublicDir = (...segments: string[]) => resolveContentRoot('public', ...segments);

export const resolveInputDir = (...segments: string[]) => resolveContentRoot('input', ...segments);

export const resolveProjectConfigPath = () => resolveContentRoot('project.config.json');

export const stageSourceVideo = async (inputPath: string, videoId: string) => {
  const extension = path.extname(inputPath) || '.mov';
  const stagedPath = resolvePublicDir('input', `${videoId}${extension}`);
  await ensureDir(path.dirname(stagedPath));
  try {
    await access(stagedPath);
    return stagedPath;
  } catch {
    // File does not exist yet, continue.
  }

  try {
    await copyFile(inputPath, stagedPath);
  } catch (error) {
    try {
      await access(stagedPath);
      return stagedPath;
    } catch {
      throw error;
    }
  }

  return stagedPath;
};

export const assertInputExists = async (inputPath: string) => {
  await stat(inputPath);
};

export const writeJson = async (targetPath: string, payload: unknown) => {
  await ensureDir(path.dirname(targetPath));
  await writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
};
