import {
  buildAmbienceFragment,
  buildCameraFragment,
  buildCaptureFragment,
  buildDialogueFragment,
  buildMotionFragment,
  buildPersonaName,
  buildSceneFragment,
  buildSfxFragment,
  buildShotId,
  buildShotLabel,
  buildShotDeltaFragment,
  buildVisualIdentityFragment,
  type PromptTemplateConfig,
} from './prompt-fragments.js';
import {renderPromptTemplate} from '../templates/render-prompt-template.js';
import type {ShotPlan, VeoConfig} from '../shots/types.js';

export interface VeoInput {
  shotIndex: number;
  shotKey: string;
  shotSlug: string;
  firstFrameInputPath: string;
  lastFrameInputPath?: string;
  referenceImagePaths: string[];
  request: {
    model: string;
    resolution: string;
    durationSeconds: number;
    personGeneration: VeoConfig['personGeneration'];
    prompt: string;
  };
}

export const buildVeoInputs = (
  shotPlan: ShotPlan,
  templates: PromptTemplateConfig,
  config: VeoConfig,
): VeoInput[] =>
  shotPlan.shots.map((shot) => ({
    shotIndex: shot.index,
    shotKey: shot.key,
    shotSlug: shot.slug,
    firstFrameInputPath: `shots/${shot.slug}/${shot.firstFrameArtifactName}`,
    lastFrameInputPath: shot.lastFrameArtifactName
      ? `shots/${shot.slug}/${shot.lastFrameArtifactName}`
      : undefined,
    referenceImagePaths: shot.activePersona.veoReferenceImagePaths,
    request: {
      model: config.model,
      resolution: config.resolution,
      durationSeconds: config.durationSeconds,
      personGeneration: config.personGeneration,
      prompt: renderPromptTemplate(templates.veo, {
        shotLabel: buildShotLabel(shot),
        shotId: buildShotId(shot),
        persona: buildPersonaName(shot),
        personaName: buildPersonaName(shot),
        visualIdentity: buildVisualIdentityFragment(shot),
        scene: buildSceneFragment(shotPlan.scene),
        shotDelta: buildShotDeltaFragment(shot),
        capture: buildCaptureFragment(shotPlan.scene),
        camera: buildCameraFragment(shot),
        motion: buildMotionFragment(shot),
        dialogue: buildDialogueFragment(shot),
        ambience: buildAmbienceFragment(shot),
        sfx: buildSfxFragment(shot),
      }),
    },
  }));
