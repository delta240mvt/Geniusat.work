import {readFileSync} from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {writeJobPack} from '../../src/ai-studio/job-pack/index.js';

const tempDirs: string[] = [];

const createTempRoot = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-studio-job-pack-'));
  tempDirs.push(tempRoot);
  return tempRoot;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, {recursive: true, force: true})));
});

const createFixture = (jobRoot: string) => ({
  jobId: '20260422-101500-ide-war',
  scriptId: 'ide_war',
  createdAt: '2026-04-22T10:15:00.000Z',
  sourcePath: 'AI Studio/virality/Tworzenie Person AI do Promocji Memów.md',
  outputRoot: jobRoot,
  strict: false,
  warnings: [
    {
      code: 'missing_cta_timing',
      message: 'CTA timing missing in source markdown; using final beat timing.',
      severity: 'warning' as const,
    },
  ],
  script: {
    script_id: 'ide_war',
    conflict_id: 'ide_war',
    viral_goal: 'wywolac plemienna walke o narzedzia',
    beats: [
      {shotId: '01-zoe-open', persona: 'Zoe', line: 'Cursor Pro robi za mnie wszystko.', start: '0:00', end: '0:04'},
      {shotId: '02-elena-response', persona: 'Elena', line: 'Agent z pamiecia sprzed kwartalu wymysla API.', start: '0:04', end: '0:11'},
      {shotId: '03-zoe-reaction', persona: 'Zoe', line: 'Dobra, zjadlo mi limit.', start: '0:11', end: '0:13'},
      {shotId: '04-elena-cta', persona: 'Elena', line: 'Po wiecej takiej terapii grupowej, follow.', start: '0:13', end: '0:15'},
    ],
  },
  personas: {
    personGeneration: 'allow_adult',
    personas: {
      zoe: {
        displayName: 'Zoe',
        references: [
          {relativePath: 'AI Studio/Zoe_base.png', absolutePath: 'C:/fixtures/AI Studio/Zoe_base.png'},
          {relativePath: 'AI Studio/Zoe_round.png', absolutePath: 'C:/fixtures/AI Studio/Zoe_round.png'},
        ],
      },
      elena: {
        displayName: 'Elena',
        references: [
          {relativePath: 'AI Studio/Elena_base.png', absolutePath: 'C:/fixtures/AI Studio/Elena_base.png'},
          {relativePath: 'AI Studio/Elena_round.png', absolutePath: 'C:/fixtures/AI Studio/Elena_round.png'},
        ],
      },
    },
  },
  audioNotes: {
    dialogueTemplate: '{{line}}',
    ambientTemplate: 'dry studio room tone',
    notes: ['Keep cuts punchy.', 'Leave space for captions.'],
  },
  editBrief: {
    summary: 'Assemble four portrait shots in order with hard cuts.',
    assemblyOrder: ['01-zoe-open', '02-elena-response', '03-zoe-reaction', '04-elena-cta'],
  },
  sceneContract: {
    angle: 'ai_cleanup_tax',
    painPoint: 'AI speeds up output but creates a verification burden.',
    contentArchetype: 'debate / confrontation',
    sceneArchetype: 'cramped late-night desk',
    locationType: 'tight improvised coding desk in a messy apartment corner',
    timeOfDay: 'late evening',
    weather: 'light rain outside the window',
    lightingQuality: 'mixed monitor glow and weak practical lamp spill',
    cameraBehavior: 'close handheld with visible micro-jitter',
    chaosLevel: 'medium-high',
    ambientActivity: 'keyboard taps, chair creaks, laptop fan, distant HVAC',
    surfaceTexture: 'worn desk, dusty peripherals, fingerprints on the screen',
    wardrobePressure: 'unstyled casual work clothes after a long session',
    propFamily: 'cables, sticky notes, cold coffee, half-open laptop, messy notebook',
    visualTension: 'overload and friction building inside a cramped workspace',
    shotDeltaPolicy: 'keep the same room and pressure, only tighten framing or body language per beat',
    previewBeat: 'Elena calling out the cleanup tax while the desk chaos frames the point.',
    captureContract: {
      format: 'raw handheld realism',
      rules: [
        'available light only',
        'uneven exposure allowed',
        'imperfect framing allowed',
        'micro focus breathing allowed',
        'slight motion blur allowed',
        'natural clutter required',
        'no ad polish',
      ],
    },
  },
  sceneRationale:
    'The cleanup-tax angle needs a cramped late-night workspace so the world itself communicates pressure, clutter, and hidden cost.',
  previewPrompt: [
    'Subject: Elena in a cramped late-night desk setup.',
    'Scene: light rain outside, mixed monitor glow, messy cables and coffee cup.',
    'Camera: close handheld portrait with slight micro-jitter.',
    'Mood: raw footage, no polish.',
  ].join('\n'),
  shots: [
    {
      shotId: '01-zoe-open',
      shotIndex: 1,
      shotKey: 'zoe_open',
      slug: 'zoe-open',
      personaId: 'zoe',
      personaDisplayName: 'Zoe',
      frameMode: 'first_only',
      promptText: 'veo 01-zoe-open',
      dialogueText: 'Cursor Pro robi za mnie wszystko.',
      sceneDelta: 'Wider framing that still shows the desk clutter behind Zoe.',
      shot: {
        shotId: '01-zoe-open',
        frameMode: 'first_only',
        sceneContractPath: '../../scene-contract.json',
      },
      nanoBananaFirst: {
        model: 'gemini-3.1-flash-image-preview',
        kind: 'first_frame',
      },
      veoRequest: {
        model: 'veo-3.1-lite-generate-preview',
        aspectRatio: '9:16',
      },
    },
    {
      shotId: '02-elena-response',
      shotIndex: 2,
      shotKey: 'elena_response',
      slug: 'elena-response',
      personaId: 'elena',
      personaDisplayName: 'Elena',
      frameMode: 'first_only',
      promptText: 'veo 02-elena-response',
      dialogueText: 'Agent z pamiecia sprzed kwartalu wymysla API.',
      sceneDelta: 'Tighter frame on Elena with the practical lamp flaring behind her shoulder.',
      shot: {
        shotId: '02-elena-response',
        frameMode: 'first_only',
        sceneContractPath: '../../scene-contract.json',
      },
      nanoBananaFirst: {
        model: 'gemini-3.1-flash-image-preview',
        kind: 'first_frame',
      },
      veoRequest: {
        model: 'veo-3.1-lite-generate-preview',
        aspectRatio: '9:16',
      },
    },
    {
      shotId: '03-zoe-reaction',
      shotIndex: 3,
      shotKey: 'zoe_reaction',
      slug: 'zoe-reaction',
      personaId: 'zoe',
      personaDisplayName: 'Zoe',
      frameMode: 'first_and_last',
      promptText: 'veo 03-zoe-reaction',
      dialogueText: 'Dobra, zjadlo mi limit.',
      sceneDelta: 'Handheld push-in as Zoe loses confidence inside the same room.',
      shot: {
        shotId: '03-zoe-reaction',
        frameMode: 'first_and_last',
        sceneContractPath: '../../scene-contract.json',
      },
      nanoBananaFirst: {
        model: 'gemini-3.1-flash-image-preview',
        kind: 'first_frame',
      },
      nanoBananaLast: {
        model: 'gemini-3.1-flash-image-preview',
        kind: 'last_frame',
      },
      veoRequest: {
        model: 'veo-3.1-lite-generate-preview',
        aspectRatio: '9:16',
        lastFrameInputPath: 'shots/03-zoe-reaction/nano-banana-last.json',
      },
    },
    {
      shotId: '04-elena-cta',
      shotIndex: 4,
      shotKey: 'elena_cta',
      slug: 'elena-cta',
      personaId: 'elena',
      personaDisplayName: 'Elena',
      frameMode: 'first_and_last',
      promptText: 'veo 04-elena-cta',
      dialogueText: 'Po wiecej takiej terapii grupowej, follow.',
      sceneDelta: 'Elena leans slightly forward, still inside the same raw desk environment.',
      shot: {
        shotId: '04-elena-cta',
        frameMode: 'first_and_last',
        sceneContractPath: '../../scene-contract.json',
      },
      nanoBananaFirst: {
        model: 'gemini-3.1-flash-image-preview',
        kind: 'first_frame',
      },
      nanoBananaLast: {
        model: 'gemini-3.1-flash-image-preview',
        kind: 'last_frame',
      },
      veoRequest: {
        model: 'veo-3.1-lite-generate-preview',
        aspectRatio: '9:16',
        lastFrameInputPath: 'shots/04-elena-cta/nano-banana-last.json',
      },
    },
  ],
});

describe('writeJobPack', () => {
  it('writes the deterministic 4-shot job pack tree with relative manifests', async () => {
    const tempRoot = await createTempRoot();
    const fixture = createFixture(path.join(tempRoot, 'output', 'ai-studio', 'jobs', '20260422-101500-ide-war'));

    const result = await writeJobPack(fixture);

    expect(result.jobRoot).toBe(fixture.outputRoot);

    const files = await collectRelativeFiles(result.jobRoot);
    expect(files).toEqual([
      'audio-notes.md',
      'edit-brief.md',
      'flow.md',
      'job.json',
      'personas.json',
      'preview-prompt.md',
      'scene-contract.json',
      'scene-rationale.md',
      'script.json',
      'shots/01-zoe-open/dialogue.txt',
      'shots/01-zoe-open/nano-banana-first.json',
      'shots/01-zoe-open/prompt.txt',
      'shots/01-zoe-open/shot.json',
      'shots/01-zoe-open/veo-request.json',
      'shots/02-elena-response/dialogue.txt',
      'shots/02-elena-response/nano-banana-first.json',
      'shots/02-elena-response/prompt.txt',
      'shots/02-elena-response/shot.json',
      'shots/02-elena-response/veo-request.json',
      'shots/03-zoe-reaction/dialogue.txt',
      'shots/03-zoe-reaction/nano-banana-first.json',
      'shots/03-zoe-reaction/nano-banana-last.json',
      'shots/03-zoe-reaction/prompt.txt',
      'shots/03-zoe-reaction/shot.json',
      'shots/03-zoe-reaction/veo-request.json',
      'shots/04-elena-cta/dialogue.txt',
      'shots/04-elena-cta/nano-banana-first.json',
      'shots/04-elena-cta/nano-banana-last.json',
      'shots/04-elena-cta/prompt.txt',
      'shots/04-elena-cta/shot.json',
      'shots/04-elena-cta/veo-request.json',
    ]);

    const jobManifest = readJson(path.join(result.jobRoot, 'job.json'));
    expect(jobManifest.scriptPath).toBe('script.json');
    expect(jobManifest.personasPath).toBe('personas.json');
    expect(jobManifest.audioNotesPath).toBe('audio-notes.md');
    expect(jobManifest.editBriefPath).toBe('edit-brief.md');
    expect(jobManifest.flowPath).toBe('flow.md');
    expect(jobManifest.sceneContractPath).toBe('scene-contract.json');
    expect(jobManifest.sceneRationalePath).toBe('scene-rationale.md');
    expect(jobManifest.previewPromptPath).toBe('preview-prompt.md');
    expect(jobManifest.shots).toHaveLength(4);
    expect(jobManifest.shots[0].directory).toBe('shots/01-zoe-open');
    expect(jobManifest.shots[2].nanoBananaLastPath).toBe('shots/03-zoe-reaction/nano-banana-last.json');

    for (const shot of jobManifest.shots) {
      await expect(fs.access(path.join(result.jobRoot, shot.shotPath))).resolves.toBeUndefined();
      await expect(fs.access(path.join(result.jobRoot, shot.promptPath))).resolves.toBeUndefined();
      await expect(fs.access(path.join(result.jobRoot, shot.dialoguePath))).resolves.toBeUndefined();
      await expect(fs.access(path.join(result.jobRoot, shot.nanoBananaFirstPath))).resolves.toBeUndefined();
      await expect(fs.access(path.join(result.jobRoot, shot.veoRequestPath))).resolves.toBeUndefined();
    }

    expect(jobManifest.shots[0].nanoBananaLastPath).toBeUndefined();
    expect(jobManifest.shots[1].nanoBananaLastPath).toBeUndefined();
    expect(jobManifest.shots[2].nanoBananaLastPath).toBeDefined();
    expect(jobManifest.shots[3].nanoBananaLastPath).toBeDefined();

    const shotManifest = readJson(path.join(result.jobRoot, 'shots', '03-zoe-reaction', 'shot.json'));
    expect(shotManifest.promptPath).toBe('prompt.txt');
    expect(shotManifest.dialoguePath).toBe('dialogue.txt');
    expect(shotManifest.nanoBananaFirstPath).toBe('nano-banana-first.json');
    expect(shotManifest.nanoBananaLastPath).toBe('nano-banana-last.json');
    expect(shotManifest.veoRequestPath).toBe('veo-request.json');
    expect(shotManifest.sceneContractPath).toBe('../../scene-contract.json');
    expect(shotManifest.sceneDelta).toContain('same room');

    const flowMarkdown = await fs.readFile(path.join(result.jobRoot, 'flow.md'), 'utf8');
    expect(flowMarkdown).toContain('# AI Studio Job Pack');
    expect(flowMarkdown).toContain('missing_cta_timing');
    expect(flowMarkdown).toContain('strict mode: off');
    expect(flowMarkdown).toContain('scene archetype: cramped late-night desk');

    const previewPrompt = await fs.readFile(path.join(result.jobRoot, 'preview-prompt.md'), 'utf8');
    expect(previewPrompt).toContain('# Preview Prompt');
    expect(previewPrompt).toContain('raw footage, no polish');

    const promptText = await fs.readFile(path.join(result.jobRoot, 'shots', '04-elena-cta', 'prompt.txt'), 'utf8');
    const dialogueText = await fs.readFile(path.join(result.jobRoot, 'shots', '04-elena-cta', 'dialogue.txt'), 'utf8');

    expect(promptText).toBe('veo 04-elena-cta\n');
    expect(dialogueText).toBe('Po wiecej takiej terapii grupowej, follow.\n');
  });

  it('rejects an existing job root unless overwrite is explicitly enabled', async () => {
    const tempRoot = await createTempRoot();
    const fixture = createFixture(path.join(tempRoot, 'output', 'ai-studio', 'jobs', '20260422-101500-ide-war'));

    await writeJobPack(fixture);

    await expect(writeJobPack(fixture)).rejects.toThrow(/already exists/i);
  });
});

const collectRelativeFiles = async (root: string) => {
  const results: string[] = [];

  const walk = async (current: string) => {
    const entries = await fs.readdir(current, {withFileTypes: true});
    const orderedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of orderedEntries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      results.push(path.relative(root, absolutePath).replaceAll(path.sep, '/'));
    }
  };

  await walk(root);
  return results;
};

const readJson = (filePath: string) => JSON.parse(readFileSync(filePath, 'utf8'));
