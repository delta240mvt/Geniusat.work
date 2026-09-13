import type {PlannedShot} from '../shots/types.js';
import type {SceneContract} from '../scene/types.js';

export interface PromptTemplateConfig {
  nanoBananaFirst: string;
  nanoBananaLast: string;
  veo: string;
}

const joinFragments = (fragments: string[]) => fragments.filter(Boolean).join('; ');

export const buildShotLabel = (shot: PlannedShot) => `${shot.index.toString().padStart(2, '0')} ${shot.slug}`;
export const buildShotId = (shot: PlannedShot) => shot.key;
export const buildPersonaName = (shot: PlannedShot) => shot.activePersona.displayName;

export const buildVisualIdentityFragment = (shot: PlannedShot) =>
  joinFragments([
    buildPersonaName(shot),
    ...shot.activePersona.identityAnchors,
    `Avoid: ${shot.activePersona.negativeConstraints.join(', ')}`,
  ]);

export const buildCameraFragment = (shot: PlannedShot) => `Camera: ${shot.camera}`;

export const buildMotionFragment = (shot: PlannedShot) => `Motion: ${shot.motion}`;

export const buildSceneFragment = (scene: SceneContract) =>
  joinFragments([
    shotPlanSceneLine('Location', scene.locationType),
    shotPlanSceneLine('Time', scene.timeOfDay),
    shotPlanSceneLine('Weather', scene.weather),
    shotPlanSceneLine('Lighting', scene.lightingQuality),
    shotPlanSceneLine('Camera behavior', scene.cameraBehavior),
    shotPlanSceneLine('Chaos', scene.chaosLevel),
    shotPlanSceneLine('Ambient activity', scene.ambientActivity),
    shotPlanSceneLine('Surface texture', scene.surfaceTexture),
    shotPlanSceneLine('Props', scene.propFamily),
    shotPlanSceneLine('Visual tension', scene.visualTension),
  ]);

export const buildCaptureFragment = (scene: SceneContract) =>
  joinFragments([
    scene.captureContract.format,
    ...scene.captureContract.rules,
  ]);

export const buildShotDeltaFragment = (shot: PlannedShot) => shot.sceneDelta ?? '';

export const buildDialogueFragment = (shot: PlannedShot) =>
  joinFragments([
    `Dialogue: ${shot.audio.dialogue}`,
    shot.audio.delivery ? `Delivery: ${shot.audio.delivery}` : '',
    shot.audio.emotion ? `Emotion: ${shot.audio.emotion}` : '',
    shot.ctaText ? `CTA: ${shot.ctaText}` : '',
  ]);

export const buildAmbienceFragment = (shot: PlannedShot) =>
  `Ambience: ${shot.audio.ambience || shot.audio.voiceProfile.acousticEnvironment}`;

export const buildSfxFragment = (shot: PlannedShot) => `SFX: ${shot.audio.sfx || 'none'}`;

const shotPlanSceneLine = (label: string, value: string) => (value ? `${label}: ${value}` : '');
