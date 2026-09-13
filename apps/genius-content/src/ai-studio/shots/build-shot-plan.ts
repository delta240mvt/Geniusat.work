import type {
  PlannedShot,
  ResolvedPersona,
  ScriptRecord,
  ShotConfig,
  ShotDefinition,
  ShotPlan,
  StudioPersonaId,
} from './types.js';
import {deriveSceneContract} from '../scene/derive-scene-contract.js';
import type {SceneContract} from '../scene/types.js';

const DEFAULT_LANGUAGE = 'en';
const FIRST_FRAME_ARTIFACT_NAME = 'nano-banana-first.json';
const LAST_FRAME_ARTIFACT_NAME = 'nano-banana-last.json';

const getPersonaById = (
  personas: ResolvedPersona[],
  personaId: StudioPersonaId,
  shotKey: string,
): ResolvedPersona => {
  const persona = personas.find((candidate) => candidate.id === personaId);

  if (!persona) {
    throw new Error(`Missing persona "${personaId}" for shot "${shotKey}".`);
  }

  return persona;
};

const buildPlannedShot = (
  definition: ShotDefinition,
  index: number,
  scriptRecord: ScriptRecord,
  personas: ResolvedPersona[],
  sceneContract: SceneContract,
): PlannedShot => {
  const beat = scriptRecord.beats[index];

  if (!beat) {
    throw new Error(
      `Script "${scriptRecord.script_id}" is missing beat ${index + 1} for shot "${definition.key}".`,
    );
  }

  if (beat.key !== definition.key) {
    throw new Error(
      `Shot "${definition.key}" expected beat "${definition.key}" but received "${beat.key}".`,
    );
  }

  if (beat.speaker !== definition.activePersonaId) {
    throw new Error(
      `Shot "${definition.key}" expected speaker "${definition.activePersonaId}" but received "${beat.speaker}".`,
    );
  }

  const activePersona = getPersonaById(personas, definition.activePersonaId, definition.key);

  return {
    index: index + 1,
    key: definition.key,
    slug: definition.slug,
    frameMode: definition.frameMode,
    activePersonaId: definition.activePersonaId,
    activePersona,
    dialogueText: beat.dialogue,
    timing: {
      startTime: beat.startTime,
      endTime: beat.endTime,
    },
    camera: definition.camera,
    motion: definition.motion,
    ctaText: index === 3 ? beat.cta ?? beat.dialogue : undefined,
    firstFrameArtifactName: FIRST_FRAME_ARTIFACT_NAME,
    lastFrameArtifactName:
      definition.frameMode === 'first_and_last' ? LAST_FRAME_ARTIFACT_NAME : undefined,
    audio: {
      dialogue: beat.dialogue,
      delivery: beat.delivery ?? '',
      emotion: beat.emotion ?? '',
      ambience: beat.ambience ?? '',
      sfx: beat.sfx ?? '',
      voiceProfile: activePersona.voiceProfile,
    },
    sceneDelta:
      index === 0
        ? `Open the debate inside the same ${sceneContract.sceneArchetype} with slightly wider framing.`
        : index === 1
          ? 'Tighten the framing to land the reversal without leaving the room.'
          : index === 2
            ? 'Increase pressure with a subtle push-in while keeping the same environmental clutter.'
            : 'Keep the same world, add a small lean-in and sharper eye contact for the CTA.',
  };
};

export const buildShotPlan = (
  scriptRecord: ScriptRecord,
  personas: ResolvedPersona[],
  shotConfig: ShotConfig,
  sceneContract?: SceneContract,
): ShotPlan => {
  if (scriptRecord.beats.length !== shotConfig.shotOrder.length) {
    throw new Error(
      `Script "${scriptRecord.script_id}" must have ${shotConfig.shotOrder.length} beats.`,
    );
  }

  const resolvedSceneContract = sceneContract ?? deriveSceneContract(scriptRecord).sceneContract;

  return {
    scriptId: scriptRecord.script_id,
    conflictId: scriptRecord.conflict_id,
    viralGoal: scriptRecord.viral_goal,
    aspectRatio: shotConfig.aspectRatio,
    imageSize: shotConfig.imageSize,
    language: shotConfig.defaultLanguage ?? DEFAULT_LANGUAGE,
    scene: resolvedSceneContract,
    shots: shotConfig.shotOrder.map((definition, index) =>
      buildPlannedShot(definition, index, scriptRecord, personas, resolvedSceneContract),
    ),
  };
};
