import type {JobPackWriteInput} from './types.js';

const withTrailingNewline = (value: string) => `${value.replace(/\s*$/u, '')}\n`;

export const renderFlowMarkdown = (input: JobPackWriteInput) => {
  const warnings = input.warnings ?? [];
  const warningLines =
    warnings.length === 0
      ? ['- none']
      : warnings.map((warning) => `- [${warning.severity}] ${warning.code}: ${warning.message}`);

  return withTrailingNewline(
    [
      '# AI Studio Job Pack',
      '',
      `- job id: ${input.jobId}`,
      `- script id: ${input.scriptId}`,
      `- source: ${input.sourcePath}`,
      `- strict mode: ${input.strict ? 'on' : 'off'}`,
      `- shots: ${input.shots.length}`,
      `- scene archetype: ${input.sceneContract.sceneArchetype}`,
      `- content archetype: ${input.sceneContract.contentArchetype}`,
      '',
      '## Shot Order',
      ...input.shots.map((shot) => `- ${shot.shotId} | ${shot.shotKey} | ${shot.frameMode}`),
      '',
      '## Warnings',
      ...warningLines,
    ].join('\n'),
  );
};

export const renderAudioNotesMarkdown = (input: JobPackWriteInput) => {
  const lines = input.script.beats.map((beat) => `- ${beat.persona}: ${beat.line}`);
  const notes = input.audioNotes.notes?.map((note) => `- ${note}`) ?? ['- none'];

  return withTrailingNewline(
    [
      '# Audio Notes',
      '',
      `- dialogue template: ${input.audioNotes.dialogueTemplate ?? 'n/a'}`,
      `- ambient template: ${input.audioNotes.ambientTemplate ?? 'n/a'}`,
      '',
      '## Dialogue',
      ...lines,
      '',
      '## Notes',
      ...notes,
    ].join('\n'),
  );
};

export const renderEditBriefMarkdown = (input: JobPackWriteInput) =>
  withTrailingNewline(
    [
      '# Edit Brief',
      '',
      input.editBrief.summary,
      '',
      '## Assembly Order',
      ...input.editBrief.assemblyOrder.map((shotId) => `- ${shotId}`),
    ].join('\n'),
  );

export const renderSceneRationaleMarkdown = (input: JobPackWriteInput) =>
  withTrailingNewline(
    [
      '# Scene Rationale',
      '',
      input.sceneRationale,
      '',
      '## Scene Contract',
      `- angle: ${input.sceneContract.angle}`,
      `- pain point: ${input.sceneContract.painPoint}`,
      `- scene archetype: ${input.sceneContract.sceneArchetype}`,
      `- preview beat: ${input.sceneContract.previewBeat}`,
    ].join('\n'),
  );

export const renderPreviewPromptMarkdown = (input: JobPackWriteInput) =>
  withTrailingNewline(
    [
      '# Preview Prompt',
      '',
      input.previewPrompt,
    ].join('\n'),
  );

export const renderTextFile = (value: string) => withTrailingNewline(value);
