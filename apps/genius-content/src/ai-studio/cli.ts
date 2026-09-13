import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveContentRoot} from '../lib/app-root.js';

import {loadAiStudioConfig} from './config/load-config.js';
import type {JsonInputValue} from './job-pack/types.js';
import {writeJobPack} from './job-pack/index.js';
import {loadScriptLibrary} from './parsers/load-script-library.js';
import type {ScriptRecord as ParsedScriptRecord} from './parsers/types.js';
import {resolvePersonaLibrary} from './personas/resolve-personas.js';
import {buildNanoBananaInputs} from './prompts/build-nano-banana-inputs.js';
import type {PromptTemplateConfig} from './prompts/prompt-fragments.js';
import {buildVeoInputs} from './prompts/build-veo-inputs.js';
import {deriveSceneContract} from './scene/derive-scene-contract.js';
import {buildShotPlan} from './shots/build-shot-plan.js';
import type {
  ResolvedPersona,
  ScriptRecord,
  ShotConfig,
  ShotDefinition,
  ShotFrameMode,
  StudioPersonaId,
} from './shots/types.js';

type ListScriptsResult = {
  scripts: ParsedScriptRecord[];
};

type BuildResult = {
  jobRoot: string;
  filePaths: string[];
  jobId: string;
  scriptId: string;
};

type MainResult = ListScriptsResult | BuildResult;

type BuildOptions = {
  scriptId: string;
  outputRoot?: string;
  strict: boolean;
};

const toJsonInputValue = <T>(value: T): JsonInputValue =>
  JSON.parse(JSON.stringify(value)) as JsonInputValue;

const SHOT_SLUGS: Record<string, string> = {
  zoe_open: '01-zoe-open',
  elena_response: '02-elena-response',
  zoe_reaction: '03-zoe-reaction',
  elena_cta: '04-elena-cta',
};

const SHOT_CAMERAS: Record<string, string> = {
  zoe_open: 'front camera handheld selfie',
  elena_response: 'static webcam close shot',
  zoe_reaction: 'slight push-in reaction close-up',
  elena_cta: 'locked webcam punchline close shot',
};

const SHOT_MOTIONS: Record<string, string> = {
  zoe_open: 'subtle handheld bobbing',
  elena_response: 'still frame with eyebrow raise',
  zoe_reaction: 'confidence collapse into awkward pause',
  elena_cta: 'small lean-in before the CTA',
};

const parseBuildOptions = (args: string[]): BuildOptions => {
  let scriptId: string | undefined;
  let outputRoot: string | undefined;
  let strict = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--script-id') {
      scriptId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--output-root') {
      outputRoot = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--no-strict') {
      strict = false;
    }
  }

  if (!scriptId) {
    throw new Error('Missing required --script-id argument.');
  }

  return {scriptId, outputRoot, strict};
};

const mapParsedScriptToShotScript = (script: ParsedScriptRecord): ScriptRecord => ({
  script_id: script.script_id,
  conflict_id: script.conflict_id,
  viral_goal: script.viral_goal,
  beats: script.beats.map((beat) => ({
    key: beat.key,
    speaker: beat.speaker as StudioPersonaId,
    startTime: beat.startTime,
    endTime: beat.endTime,
    dialogue: beat.dialogue,
    delivery: beat.delivery,
    emotion: beat.emotion,
    ambience: beat.ambience,
    sfx: beat.sfx,
    cta: beat.cta,
  })),
});

const mapPersonasToShotPersonas = (
  personas: ReturnType<typeof resolvePersonaLibrary>,
): ResolvedPersona[] =>
  Object.values(personas).map((persona) => ({
    id: persona.id as StudioPersonaId,
    displayName: persona.displayName,
    referenceImagePaths: persona.canonicalRefs.nanoBanana.map((reference) => reference.relativePath),
    identityAnchors: [...persona.identityAnchors],
    negativeConstraints: [...persona.negativeConstraints],
    voiceProfile: {
      timbre: persona.voiceProfile.timbre ?? '',
      cadence: persona.voiceProfile.cadence ?? '',
      mouthMovement: persona.voiceProfile.mouthMovement ?? '',
      acousticEnvironment: persona.voiceProfile.acousticEnvironment ?? '',
    },
    veoReferenceImagePaths: persona.canonicalRefs.veo.map((reference) => reference.relativePath),
  }));

const mapShotDefinitions = (
  config: Awaited<ReturnType<typeof loadAiStudioConfig>>,
): ShotDefinition[] =>
  config.shots.sequence.map((shotKey) => ({
    key: shotKey,
    slug: SHOT_SLUGS[shotKey] ?? shotKey.replaceAll('_', '-'),
    frameMode: config.shots.definitions[shotKey].frameMode as ShotFrameMode,
    activePersonaId: config.shots.definitions[shotKey].activePersona as StudioPersonaId,
    camera: SHOT_CAMERAS[shotKey] ?? 'portrait social video close-up',
    motion: SHOT_MOTIONS[shotKey] ?? 'subtle social-video realism motion',
  }));

const buildShotConfig = (
  config: Awaited<ReturnType<typeof loadAiStudioConfig>>,
): ShotConfig => ({
  aspectRatio: config.studio.defaultAspectRatio,
  imageSize: config.models.nanoBanana.imageSize,
  defaultLanguage: config.studio.defaultLanguage,
  nanoBanana: {
    model: config.models.nanoBanana.defaultModel,
  },
  veo: {
    model: config.models.veo.defaultModel,
    resolution: config.models.veo.resolution,
    durationSeconds: config.models.veo.durationSeconds,
    personGeneration: config.models.veo.personGeneration,
  },
  shotOrder: mapShotDefinitions(config),
});

const buildPromptTemplates = (
  config: Awaited<ReturnType<typeof loadAiStudioConfig>>,
): PromptTemplateConfig => ({
  nanoBananaFirst: [
    config.prompts.nanoBanana.firstFrameTemplate,
    'Scene: {{scene}}',
    'Shot delta: {{shotDelta}}',
    'Capture: {{capture}}',
    '{{camera}}',
    '{{motion}}',
    '{{dialogue}}',
    '{{ambience}}',
  ].join('\n'),
  nanoBananaLast: [
    config.prompts.nanoBanana.lastFrameTemplate,
    'Scene: {{scene}}',
    'Shot delta: {{shotDelta}}',
    'Capture: {{capture}}',
    '{{camera}}',
    '{{motion}}',
    '{{dialogue}}',
    '{{ambience}}',
  ].join('\n'),
  veo: [
    config.prompts.veo.shotTemplate,
    'Scene: {{scene}}',
    'Shot delta: {{shotDelta}}',
    'Capture: {{capture}}',
    'Dialogue: {{dialogue}}',
    'Ambience: {{ambience}}',
    'SFX: {{sfx}}',
  ].join('\n'),
});

const buildJobId = (scriptId: string, createdAt: Date) =>
  `${createdAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${scriptId.replaceAll('_', '-')}`;

const buildJobPackInput = ({
  script,
  shotPlan,
  personas,
  nanoBananaInputs,
  veoInputs,
  jobId,
  jobRoot,
  createdAt,
  sourcePath,
  strict,
  audioTemplates,
  sceneContract,
  sceneRationale,
  previewPrompt,
}: {
  script: ParsedScriptRecord;
  shotPlan: ReturnType<typeof buildShotPlan>;
  personas: ReturnType<typeof resolvePersonaLibrary>;
  nanoBananaInputs: ReturnType<typeof buildNanoBananaInputs>;
  veoInputs: ReturnType<typeof buildVeoInputs>;
  jobId: string;
  jobRoot: string;
  createdAt: string;
  sourcePath: string;
  strict: boolean;
  audioTemplates: {
    dialogueTemplate: string;
    ambientTemplate: string;
  };
  sceneContract: ReturnType<typeof deriveSceneContract>['sceneContract'];
  sceneRationale: string;
  previewPrompt: string;
}) => ({
  jobId,
  scriptId: script.script_id,
  createdAt,
  sourcePath,
  outputRoot: jobRoot,
  strict,
  warnings: [],
  script: {
    script_id: script.script_id,
    conflict_id: script.conflict_id,
    viral_goal: script.viral_goal,
    beats: shotPlan.shots.map((shot) => ({
      shotId: shot.slug,
      persona: shot.activePersona.displayName,
      line: shot.dialogueText,
      start: shot.timing.startTime,
      end: shot.timing.endTime,
    })),
  },
  personas: {
    personGeneration: 'allow_adult',
    personas: Object.fromEntries(
      Object.entries(personas).map(([id, persona]) => [
        id,
        {
          displayName: persona.displayName,
          references: persona.canonicalRefs.all.map((reference) => ({
            relativePath: reference.relativePath,
            absolutePath: reference.absolutePath,
          })),
          identityAnchors: persona.identityAnchors,
          negativeConstraints: persona.negativeConstraints,
          futureVoice: persona.futureVoice,
        },
      ]),
    ),
  },
  audioNotes: {
    dialogueTemplate: audioTemplates.dialogueTemplate,
    ambientTemplate: audioTemplates.ambientTemplate,
    notes: [
      'Keep cuts punchy and caption-safe.',
      'Use Nano Banana first frames for all shots.',
      'Use Nano Banana last frames only for reaction and CTA shots.',
    ],
  },
  editBrief: {
    summary: 'Assemble the four portrait shots in order with hard cuts and social-video pacing.',
    assemblyOrder: shotPlan.shots.map((shot) => shot.slug),
  },
  sceneContract,
  sceneRationale,
  previewPrompt,
  shots: shotPlan.shots.map((shot) => {
    const nanoBananaFirst = nanoBananaInputs.firstFrameInputs.find((input) => input.shotKey === shot.key);
    const nanoBananaLast = nanoBananaInputs.lastFrameInputs.find((input) => input.shotKey === shot.key);
    const veoRequest = veoInputs.find((input) => input.shotKey === shot.key);

    if (!nanoBananaFirst || !veoRequest) {
      throw new Error(`Missing generated payloads for shot "${shot.key}".`);
    }

    return {
      shotId: shot.slug,
      shotIndex: shot.index,
      shotKey: shot.key,
      slug: shot.slug.replace(/^\d{2}-/, ''),
      personaId: shot.activePersonaId,
      personaDisplayName: shot.activePersona.displayName,
      frameMode: shot.frameMode,
      promptText: veoRequest.request.prompt,
      dialogueText: shot.dialogueText,
      shot: {
        shotId: shot.slug,
        frameMode: shot.frameMode,
        camera: shot.camera,
        motion: shot.motion,
        timing: shot.timing,
        sceneContractPath: '../../scene-contract.json',
        sceneDelta: shot.sceneDelta,
      },
      sceneDelta: shot.sceneDelta,
      nanoBananaFirst: toJsonInputValue(nanoBananaFirst),
      nanoBananaLast: nanoBananaLast ? toJsonInputValue(nanoBananaLast) : undefined,
      veoRequest: toJsonInputValue({
        ...veoRequest.request,
        firstFrameInputPath: veoRequest.firstFrameInputPath,
        lastFrameInputPath: veoRequest.lastFrameInputPath,
        referenceImagePaths: veoRequest.referenceImagePaths,
      }),
    };
  }),
});

type MainOptions = {contentRoot?: string};
export function main(argv: ['list-scripts', ...string[]], options?: MainOptions): Promise<ListScriptsResult>;
export function main(argv: ['build', ...string[]], options?: MainOptions): Promise<BuildResult>;
export function main(argv: string[], options?: MainOptions): Promise<MainResult>;
export async function main(argv: string[], {contentRoot = resolveContentRoot()}: MainOptions = {}): Promise<MainResult> {
  const [command, ...rest] = argv;

  if (command === 'list-scripts') {
    return {
      scripts: loadScriptLibrary(path.join(contentRoot, 'AI Studio/virality/Tworzenie Person AI do Promocji Memów.md')).scripts,
    };
  }

  if (command !== 'build') {
    throw new Error(`Unsupported AI Studio command "${command ?? ''}".`);
  }

  const buildOptions = parseBuildOptions(rest);
  const config = await loadAiStudioConfig({contentRoot});
  const scriptLibrary = loadScriptLibrary(config.studio.sourceFileAbsolute);
  const script = scriptLibrary.scripts.find((entry) => entry.script_id === buildOptions.scriptId);

  if (!script) {
    throw new Error(`Unknown script_id "${buildOptions.scriptId}".`);
  }

  const promptTemplates = buildPromptTemplates(config);
  const shotConfig = buildShotConfig(config);
  const personaLibrary = resolvePersonaLibrary(config);
  const sceneDerivation = deriveSceneContract(mapParsedScriptToShotScript(script));
  const shotPlan = buildShotPlan(
    mapParsedScriptToShotScript(script),
    mapPersonasToShotPersonas(personaLibrary),
    shotConfig,
    sceneDerivation.sceneContract,
  );
  const nanoBananaInputs = buildNanoBananaInputs(shotPlan, promptTemplates, shotConfig.nanoBanana);
  const veoInputs = buildVeoInputs(shotPlan, promptTemplates, shotConfig.veo);
  const createdAt = new Date();
  const jobId = buildJobId(script.script_id, createdAt);
  const outputRoot = buildOptions.outputRoot
    ? path.resolve(buildOptions.outputRoot)
    : config.studio.outputRootAbsolute;
  const jobRoot = path.join(outputRoot, jobId);

  const result = await writeJobPack(
    buildJobPackInput({
      script,
      shotPlan,
      personas: personaLibrary,
      nanoBananaInputs,
      veoInputs,
      jobId,
      jobRoot,
      createdAt: createdAt.toISOString(),
      sourcePath: config.studio.sourceFile,
      strict: buildOptions.strict,
      audioTemplates: config.prompts.audio,
      sceneContract: sceneDerivation.sceneContract,
      sceneRationale: sceneDerivation.sceneRationale,
      previewPrompt: nanoBananaInputs.firstFrameInputs[1]?.prompt ?? nanoBananaInputs.firstFrameInputs[0]?.prompt ?? '',
    }),
  );

  return {
    ...result,
    jobId,
    scriptId: script.script_id,
  };
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentFilePath = fileURLToPath(import.meta.url);

if (entryPath && currentFilePath === entryPath) {
  main(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
