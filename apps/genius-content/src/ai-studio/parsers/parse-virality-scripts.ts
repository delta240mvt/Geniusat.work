import path from 'node:path';

import type {
  ParseViralityScriptsOptions,
  ScriptBeat,
  ScriptLibrary,
  ScriptRecord,
} from './types.js';

const READY_SCRIPTS_HEADING = '## 12. Gotowe Skrypty';
const SCRIPT_BLOCK_HEADING = /^##\s+12\.\d+\s+Skrypt:\s+(.+)$/m;
const BEAT_KEYS = ['zoe_open', 'elena_response', 'zoe_reaction', 'elena_cta'] as const;

const buildFieldPattern = (fieldName: string) =>
  new RegExp(`\\\`${fieldName}\\\`:\\s*\\\`([^\\\`]+)\\\``, 'i');

const normalizeSpeaker = (speaker: string) => speaker.trim().toLowerCase();

const normalizeDialogue = (dialogueLines: string[]) =>
  dialogueLines
    .map((line) => line.trim().replace(/^>\s*/, '').replace(/^"|"$/g, ''))
    .join(' ')
    .trim();

const parseTimeRange = (timeRange: string) => {
  const [startTime, endTime] = timeRange.split('-').map((segment) => segment.trim());

  if (!startTime || !endTime) {
    throw new Error(`Invalid beat time range "${timeRange}".`);
  }

  return {startTime, endTime};
};

export const extractReadyScriptsSection = (markdown: string) => {
  const headingIndex = markdown.indexOf(READY_SCRIPTS_HEADING);

  if (headingIndex === -1) {
    throw new Error('Could not find the ready scripts section in the virality markdown.');
  }

  return markdown.slice(headingIndex);
};

export const splitScriptBlocks = (section: string) => {
  const lines = section.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (/^##\s+12\.\d+\s+Skrypt:\s+/.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n').trim());
      }

      currentBlock = [line];
      continue;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n').trim());
  }

  return blocks.filter(Boolean);
};

export const parseDialogueBeats = (
  block: string,
  sourcePath: string,
): [ScriptBeat, ScriptBeat, ScriptBeat, ScriptBeat] => {
  const lines = block.split(/\r?\n/);
  const beats: ScriptBeat[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^\`([^`]+)\`\s+([^:]+):\s*$/);

    if (!match) {
      continue;
    }

    const [, timeRange, speakerLabel] = match;
    const dialogueLines: string[] = [];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor]?.trim() ?? '';

      if (!candidate) {
        if (dialogueLines.length > 0) {
          break;
        }

        cursor += 1;
        continue;
      }

      if (candidate.startsWith('`') && candidate.includes(':')) {
        break;
      }

      if (candidate.startsWith('## ')) {
        break;
      }

      dialogueLines.push(candidate);
      cursor += 1;
    }

    const {startTime, endTime} = parseTimeRange(timeRange);
    const normalizedSpeaker = normalizeSpeaker(speakerLabel);
    const beatIndex = beats.length;
    const dialogue = normalizeDialogue(dialogueLines);

    beats.push({
      key: BEAT_KEYS[beatIndex] ?? `beat_${beatIndex + 1}`,
      index: beatIndex + 1,
      speaker: normalizedSpeaker,
      startTime,
      endTime,
      dialogue,
      cta: beatIndex === 3 ? dialogue : undefined,
    });

    index = cursor - 1;
  }

  if (beats.length !== 4) {
    throw new Error(
      `Script block in ${sourcePath} must contain exactly 4 beats, received ${beats.length}.`,
    );
  }

  return beats as [ScriptBeat, ScriptBeat, ScriptBeat, ScriptBeat];
};

export const parseScriptBlock = (
  block: string,
  sourcePath: string,
  strict = true,
): ScriptRecord => {
  const titleMatch = block.match(SCRIPT_BLOCK_HEADING);
  const scriptIdMatch = block.match(buildFieldPattern('script_id'));
  const conflictIdMatch = block.match(buildFieldPattern('conflict_id'));
  const viralGoalMatch = block.match(/\`viral_goal\`:\s*\n\s*-\s+([^\n]+)/i);

  if (!titleMatch || !scriptIdMatch || !conflictIdMatch || !viralGoalMatch) {
    throw new Error(`Script block in ${sourcePath} is structurally incomplete.`);
  }

  const beats = parseDialogueBeats(block, sourcePath);

  if (strict && beats.length !== 4) {
    throw new Error(`Script block in ${sourcePath} must contain exactly 4 beats.`);
  }

  return {
    title: titleMatch[1].trim(),
    script_id: scriptIdMatch[1].trim(),
    conflict_id: conflictIdMatch[1].trim(),
    viral_goal: viralGoalMatch[1].trim(),
    beats,
    sourcePath: path.normalize(sourcePath),
  };
};

export const assertUniqueScriptIds = (records: ScriptRecord[]) => {
  const seen = new Set<string>();

  for (const record of records) {
    if (seen.has(record.script_id)) {
      throw new Error(`Found duplicate script_id "${record.script_id}".`);
    }

    seen.add(record.script_id);
  }
};

export const parseViralityScripts = (
  markdown: string,
  options: ParseViralityScriptsOptions,
): ScriptLibrary => {
  const sourcePath = path.normalize(options.sourcePath);
  const section = extractReadyScriptsSection(markdown);
  const blocks = splitScriptBlocks(section);
  const scripts = blocks.map((block) => parseScriptBlock(block, sourcePath, options.strict ?? true));

  assertUniqueScriptIds(scripts);

  return {
    sourcePath,
    scriptIds: scripts.map((script) => script.script_id),
    scripts,
  };
};
