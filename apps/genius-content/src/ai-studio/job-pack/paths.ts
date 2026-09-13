import path from 'node:path';

import {resolveContentRoot} from '../../lib/app-root.js';

import type {JobPackWriteInput} from './types.js';

const toPosixPath = (value: string) => value.replaceAll(path.sep, '/');

const formatShotDirectoryName = (shotIndex: number, slug: string) =>
  /^\d{2}-/.test(slug) ? slug : `${String(shotIndex).padStart(2, '0')}-${slug}`;

export interface JobPackShotPaths {
  directoryName: string;
  directoryAbsolute: string;
  directoryRelative: string;
  shotPath: string;
  promptPath: string;
  dialoguePath: string;
  nanoBananaFirstPath: string;
  nanoBananaLastPath?: string;
  veoRequestPath: string;
}

export interface JobPackResolvedPaths {
  jobRoot: string;
  jobJsonPath: string;
  scriptPath: string;
  personasPath: string;
  sceneContractPath: string;
  sceneRationalePath: string;
  previewPromptPath: string;
  audioNotesPath: string;
  editBriefPath: string;
  flowPath: string;
  shotsRoot: string;
  shots: JobPackShotPaths[];
}

export const resolveJobPackOutputRoot = (...segments: string[]) =>
  resolveContentRoot('output', 'ai-studio', 'jobs', ...segments);

export const resolveJobPackPaths = (input: JobPackWriteInput): JobPackResolvedPaths => {
  const jobRoot = path.resolve(input.outputRoot);
  const shotsRoot = path.join(jobRoot, 'shots');

  return {
    jobRoot,
    jobJsonPath: path.join(jobRoot, 'job.json'),
    scriptPath: path.join(jobRoot, 'script.json'),
    personasPath: path.join(jobRoot, 'personas.json'),
    sceneContractPath: path.join(jobRoot, 'scene-contract.json'),
    sceneRationalePath: path.join(jobRoot, 'scene-rationale.md'),
    previewPromptPath: path.join(jobRoot, 'preview-prompt.md'),
    audioNotesPath: path.join(jobRoot, 'audio-notes.md'),
    editBriefPath: path.join(jobRoot, 'edit-brief.md'),
    flowPath: path.join(jobRoot, 'flow.md'),
    shotsRoot,
    shots: input.shots.map((shot) => {
      const directoryName = formatShotDirectoryName(shot.shotIndex, shot.slug);
      const directoryRelative = toPosixPath(path.posix.join('shots', directoryName));
      const directoryAbsolute = path.join(shotsRoot, directoryName);

      return {
        directoryName,
        directoryAbsolute,
        directoryRelative,
        shotPath: toPosixPath(path.posix.join(directoryRelative, 'shot.json')),
        promptPath: toPosixPath(path.posix.join(directoryRelative, 'prompt.txt')),
        dialoguePath: toPosixPath(path.posix.join(directoryRelative, 'dialogue.txt')),
        nanoBananaFirstPath: toPosixPath(path.posix.join(directoryRelative, 'nano-banana-first.json')),
        nanoBananaLastPath: shot.nanoBananaLast
          ? toPosixPath(path.posix.join(directoryRelative, 'nano-banana-last.json'))
          : undefined,
        veoRequestPath: toPosixPath(path.posix.join(directoryRelative, 'veo-request.json')),
      };
    }),
  };
};
