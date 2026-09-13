import {
  buildAmbienceFragment,
  buildCameraFragment,
  buildCaptureFragment,
  buildDialogueFragment,
  buildMotionFragment,
  buildPersonaName,
  buildSceneFragment,
  buildShotId,
  buildShotLabel,
  buildShotDeltaFragment,
  buildVisualIdentityFragment,
  type PromptTemplateConfig,
} from './prompt-fragments.js';
import {renderPromptTemplate} from '../templates/render-prompt-template.js';
import type {NanoBananaConfig, PlannedShot, ShotPlan} from '../shots/types.js';

export interface NanoBananaInput {
  shotIndex: number;
  shotKey: string;
  shotSlug: string;
  variant: 'first' | 'last';
  model: string;
  aspectRatio: string;
  imageSize: string;
  outputPath: string;
  referenceImagePaths: string[];
  prompt: string;
}

export interface NanoBananaInputs {
  firstFrameInputs: NanoBananaInput[];
  lastFrameInputs: NanoBananaInput[];
}

const buildPrompt = (
  shot: PlannedShot,
  template: string,
  shotPlan: ShotPlan,
) =>
  renderPromptTemplate(template, {
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
    aspectRatio: shotPlan.aspectRatio,
    imageSize: shotPlan.imageSize,
    language: shotPlan.language,
  });

const createInput = (
  shot: PlannedShot,
  template: string,
  variant: 'first' | 'last',
  shotPlan: ShotPlan,
  config: NanoBananaConfig,
): NanoBananaInput => ({
  shotIndex: shot.index,
  shotKey: shot.key,
  shotSlug: shot.slug,
  variant,
  model: config.model,
  aspectRatio: shotPlan.aspectRatio,
  imageSize: shotPlan.imageSize,
  outputPath: `shots/${shot.slug}/${variant === 'first' ? shot.firstFrameArtifactName : shot.lastFrameArtifactName}`,
  referenceImagePaths: shot.activePersona.referenceImagePaths,
  prompt: buildPrompt(shot, template, shotPlan),
});

export const buildNanoBananaInputs = (
  shotPlan: ShotPlan,
  templates: PromptTemplateConfig,
  config: NanoBananaConfig,
): NanoBananaInputs => ({
  firstFrameInputs: shotPlan.shots.map((shot) =>
    createInput(shot, templates.nanoBananaFirst, 'first', shotPlan, config),
  ),
  lastFrameInputs: shotPlan.shots
    .filter((shot) => shot.frameMode === 'first_and_last' && shot.lastFrameArtifactName)
    .map((shot) => createInput(shot, templates.nanoBananaLast, 'last', shotPlan, config)),
});
