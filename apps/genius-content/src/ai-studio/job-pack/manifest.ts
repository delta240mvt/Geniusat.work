import type {JobPackResolvedPaths, JobPackShotPaths} from './paths.js';
import type {JobPackShotInput, JobPackWriteInput} from './types.js';

const toRelativeRootPath = (absoluteRoot: string, absolutePath: string) =>
  absolutePath.slice(absoluteRoot.length + 1).replaceAll('\\', '/');

export const createShotManifest = (
  paths: JobPackShotPaths,
  shot: JobPackShotInput,
) => ({
  shotId: shot.shotId,
  shotIndex: shot.shotIndex,
  shotKey: shot.shotKey,
  slug: shot.slug,
  personaId: shot.personaId,
  personaDisplayName: shot.personaDisplayName,
  frameMode: shot.frameMode,
  promptPath: 'prompt.txt',
  dialoguePath: 'dialogue.txt',
  sceneContractPath: '../../scene-contract.json',
  sceneDelta: shot.sceneDelta,
  nanoBananaFirstPath: 'nano-banana-first.json',
  nanoBananaLastPath: paths.nanoBananaLastPath ? 'nano-banana-last.json' : undefined,
  veoRequestPath: 'veo-request.json',
});

export const createJobManifest = (
  input: JobPackWriteInput,
  paths: JobPackResolvedPaths,
) => ({
  jobId: input.jobId,
  scriptId: input.scriptId,
  createdAt: input.createdAt,
  sourcePath: input.sourcePath,
  strict: input.strict,
  scriptPath: toRelativeRootPath(paths.jobRoot, paths.scriptPath),
  personasPath: toRelativeRootPath(paths.jobRoot, paths.personasPath),
  sceneContractPath: toRelativeRootPath(paths.jobRoot, paths.sceneContractPath),
  sceneRationalePath: toRelativeRootPath(paths.jobRoot, paths.sceneRationalePath),
  previewPromptPath: toRelativeRootPath(paths.jobRoot, paths.previewPromptPath),
  audioNotesPath: toRelativeRootPath(paths.jobRoot, paths.audioNotesPath),
  editBriefPath: toRelativeRootPath(paths.jobRoot, paths.editBriefPath),
  flowPath: toRelativeRootPath(paths.jobRoot, paths.flowPath),
  shots: input.shots.map((shot, index) => {
    const shotPaths = paths.shots[index];

    return {
      shotId: shot.shotId,
      shotIndex: shot.shotIndex,
      shotKey: shot.shotKey,
      directory: shotPaths.directoryRelative,
      shotPath: shotPaths.shotPath,
      promptPath: shotPaths.promptPath,
      dialoguePath: shotPaths.dialoguePath,
      nanoBananaFirstPath: shotPaths.nanoBananaFirstPath,
      nanoBananaLastPath: shotPaths.nanoBananaLastPath,
      veoRequestPath: shotPaths.veoRequestPath,
    };
  }),
});
