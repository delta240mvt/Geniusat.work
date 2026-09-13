import fs from 'node:fs/promises';
import path from 'node:path';

import {createJobManifest, createShotManifest} from './manifest.js';
import {
  renderAudioNotesMarkdown,
  renderEditBriefMarkdown,
  renderFlowMarkdown,
  renderPreviewPromptMarkdown,
  renderSceneRationaleMarkdown,
  renderTextFile,
} from './markdown.js';
import {resolveJobPackPaths} from './paths.js';
import type {JobPackWriteInput, JsonInputValue, JobPackWriteResult, WriteJobPackOptions} from './types.js';

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const ensureFreshJobRoot = async (jobRoot: string, overwrite: boolean) => {
  try {
    await fs.access(jobRoot);
  } catch {
    return;
  }

  if (!overwrite) {
    throw new Error(`Job pack root already exists: ${jobRoot}`);
  }

  await fs.rm(jobRoot, {recursive: true, force: true});
};

export const writeJobPack = async (
  input: JobPackWriteInput,
  options: WriteJobPackOptions = {},
): Promise<JobPackWriteResult> => {
  if (input.shots.length !== 4) {
    throw new Error(`Expected exactly 4 shots, received ${input.shots.length}.`);
  }

  const paths = resolveJobPackPaths(input);
  await ensureFreshJobRoot(paths.jobRoot, options.overwrite ?? false);

  await fs.mkdir(paths.shotsRoot, {recursive: true});

  const writtenFiles: string[] = [];
  const recordFile = (filePath: string) => {
    writtenFiles.push(path.relative(paths.jobRoot, filePath).replaceAll(path.sep, '/'));
  };

  await writeJsonFile(paths.scriptPath, input.script);
  recordFile(paths.scriptPath);

  await writeJsonFile(paths.personasPath, input.personas);
  recordFile(paths.personasPath);

  await writeJsonFile(paths.sceneContractPath, input.sceneContract);
  recordFile(paths.sceneContractPath);

  await fs.writeFile(paths.sceneRationalePath, renderSceneRationaleMarkdown(input), 'utf8');
  recordFile(paths.sceneRationalePath);

  await fs.writeFile(paths.previewPromptPath, renderPreviewPromptMarkdown(input), 'utf8');
  recordFile(paths.previewPromptPath);

  await fs.writeFile(paths.audioNotesPath, renderAudioNotesMarkdown(input), 'utf8');
  recordFile(paths.audioNotesPath);

  await fs.writeFile(paths.editBriefPath, renderEditBriefMarkdown(input), 'utf8');
  recordFile(paths.editBriefPath);

  await fs.writeFile(paths.flowPath, renderFlowMarkdown(input), 'utf8');
  recordFile(paths.flowPath);

  for (const [index, shot] of input.shots.entries()) {
    const shotPaths = paths.shots[index];
    await fs.mkdir(shotPaths.directoryAbsolute, {recursive: true});

    await writeJsonFile(path.join(shotPaths.directoryAbsolute, 'shot.json'), createShotManifest(shotPaths, shot));
    recordFile(path.join(shotPaths.directoryAbsolute, 'shot.json'));

    await fs.writeFile(path.join(shotPaths.directoryAbsolute, 'prompt.txt'), renderTextFile(shot.promptText), 'utf8');
    recordFile(path.join(shotPaths.directoryAbsolute, 'prompt.txt'));

    await fs.writeFile(path.join(shotPaths.directoryAbsolute, 'dialogue.txt'), renderTextFile(shot.dialogueText), 'utf8');
    recordFile(path.join(shotPaths.directoryAbsolute, 'dialogue.txt'));

    await writeJsonFile(path.join(shotPaths.directoryAbsolute, 'nano-banana-first.json'), shot.nanoBananaFirst);
    recordFile(path.join(shotPaths.directoryAbsolute, 'nano-banana-first.json'));

    if (shot.nanoBananaLast) {
      await writeJsonFile(path.join(shotPaths.directoryAbsolute, 'nano-banana-last.json'), shot.nanoBananaLast);
      recordFile(path.join(shotPaths.directoryAbsolute, 'nano-banana-last.json'));
    }

    await writeJsonFile(path.join(shotPaths.directoryAbsolute, 'veo-request.json'), shot.veoRequest);
    recordFile(path.join(shotPaths.directoryAbsolute, 'veo-request.json'));
  }

  await writeJsonFile(paths.jobJsonPath, createJobManifest(input, paths));
  recordFile(paths.jobJsonPath);

  writtenFiles.sort((left, right) => left.localeCompare(right));

  return {
    jobRoot: paths.jobRoot,
    filePaths: writtenFiles,
  };
};
