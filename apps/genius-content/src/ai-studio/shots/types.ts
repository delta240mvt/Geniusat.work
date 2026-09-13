export type StudioPersonaId = 'zoe' | 'elena';
export type ShotFrameMode = 'first_only' | 'first_and_last';
export type PersonGenerationPolicy = 'allow_adult' | 'disallow';

import type {SceneContract} from '../scene/types.js';

export interface VoiceProfile {
  timbre: string;
  cadence: string;
  mouthMovement: string;
  acousticEnvironment: string;
}

export interface ResolvedPersona {
  id: StudioPersonaId;
  displayName: string;
  referenceImagePaths: string[];
  identityAnchors: string[];
  negativeConstraints: string[];
  voiceProfile: VoiceProfile;
  veoReferenceImagePaths: string[];
}

export interface ScriptBeat {
  key: string;
  speaker: StudioPersonaId;
  startTime: string;
  endTime: string;
  dialogue: string;
  delivery?: string;
  emotion?: string;
  ambience?: string;
  sfx?: string;
  cta?: string;
}

export interface ScriptRecord {
  script_id: string;
  conflict_id: string;
  viral_goal: string;
  beats: ScriptBeat[];
}

export interface ShotDefinition {
  key: string;
  slug: string;
  frameMode: ShotFrameMode;
  activePersonaId: StudioPersonaId;
  camera: string;
  motion: string;
}

export interface NanoBananaConfig {
  model: string;
}

export interface VeoConfig {
  model: string;
  resolution: string;
  durationSeconds: number;
  personGeneration: PersonGenerationPolicy;
}

export interface ShotConfig {
  aspectRatio: string;
  imageSize: string;
  defaultLanguage?: string;
  nanoBanana: NanoBananaConfig;
  veo: VeoConfig;
  shotOrder: ShotDefinition[];
}

export interface PlannedShotAudio {
  dialogue: string;
  delivery: string;
  emotion: string;
  ambience: string;
  sfx: string;
  voiceProfile: VoiceProfile;
}

export interface PlannedShot {
  index: number;
  key: string;
  slug: string;
  frameMode: ShotFrameMode;
  activePersonaId: StudioPersonaId;
  activePersona: ResolvedPersona;
  dialogueText: string;
  timing: {
    startTime: string;
    endTime: string;
  };
  camera: string;
  motion: string;
  ctaText?: string;
  firstFrameArtifactName: string;
  lastFrameArtifactName?: string;
  audio: PlannedShotAudio;
  sceneDelta?: string;
}

export interface ShotPlan {
  scriptId: string;
  conflictId: string;
  viralGoal: string;
  aspectRatio: string;
  imageSize: string;
  language: string;
  scene: SceneContract;
  shots: PlannedShot[];
}
