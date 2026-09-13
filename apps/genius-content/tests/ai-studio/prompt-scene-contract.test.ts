import {describe, expect, it} from 'vitest';

import {buildNanoBananaInputs} from '../../src/ai-studio/prompts/build-nano-banana-inputs.js';
import {buildVeoInputs} from '../../src/ai-studio/prompts/build-veo-inputs.js';
import type {PromptTemplateConfig} from '../../src/ai-studio/prompts/prompt-fragments.js';
import type {ShotPlan} from '../../src/ai-studio/shots/types.js';

const shotPlan: ShotPlan = {
  scriptId: 'ai_cleanup_tax',
  conflictId: 'ai_cleanup_tax',
  viralGoal: 'Flip AI speed into verification pain.',
  aspectRatio: '9:16',
  imageSize: '1536x1024',
  language: 'en-US',
  scene: {
    angle: 'ai_cleanup_tax',
    painPoint: 'AI creates a cleanup tax.',
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
    previewBeat: 'Elena calling out the cleanup tax while desk clutter frames the point.',
    captureContract: {
      format: 'raw handheld realism',
      rules: ['available light only', 'uneven exposure allowed', 'no ad polish'],
    },
  },
  shots: [
    {
      index: 1,
      key: 'zoe_open',
      slug: '01-zoe-open',
      frameMode: 'first_only',
      activePersonaId: 'zoe',
      activePersona: {
        id: 'zoe',
        displayName: 'Zoe',
        referenceImagePaths: ['AI Studio/Zoe_base.png', 'AI Studio/Zoe_round.png'],
        identityAnchors: ['adult woman', 'short dark hair'],
        negativeConstraints: ['glossy fashion look'],
        voiceProfile: {
          timbre: 'bright',
          cadence: 'quick',
          mouthMovement: 'precise',
          acousticEnvironment: 'small untreated room',
        },
        veoReferenceImagePaths: ['AI Studio/Zoe_base.png', 'AI Studio/Zoe_round.png'],
      },
      dialogueText: 'AI already does it faster than you.',
      timing: {startTime: '0:00', endTime: '0:04'},
      camera: 'front camera handheld selfie',
      motion: 'subtle handheld bobbing',
      firstFrameArtifactName: 'nano-banana-first.json',
      audio: {
        dialogue: 'AI already does it faster than you.',
        delivery: 'dismissive',
        emotion: 'cocky',
        ambience: 'keyboard taps and fan hum',
        sfx: 'chair creak',
        voiceProfile: {
          timbre: 'bright',
          cadence: 'quick',
          mouthMovement: 'precise',
          acousticEnvironment: 'small untreated room',
        },
      },
      sceneDelta: 'Wider framing that still shows the desk clutter behind Zoe.',
    },
  ],
};

const templates: PromptTemplateConfig = {
  nanoBananaFirst: [
    'Subject: {{persona}}.',
    'Scene: {{scene}}.',
    'Shot delta: {{shotDelta}}.',
    'Capture: {{capture}}.',
    'Camera: {{camera}}.',
    'Motion: {{motion}}.',
    'Dialogue: {{dialogue}}.',
    'Ambience: {{ambience}}.',
  ].join('\n'),
  nanoBananaLast: 'unused',
  veo: [
    'Subject: {{persona}}.',
    'Scene: {{scene}}.',
    'Shot delta: {{shotDelta}}.',
    'Capture: {{capture}}.',
    'Camera: {{camera}}.',
    'Motion: {{motion}}.',
    'Dialogue: {{dialogue}}.',
    'Ambience: {{ambience}}.',
    'SFX: {{sfx}}.',
  ].join('\n'),
};

describe('scene contract prompt inheritance', () => {
  it('injects scene and capture contract language into Nano Banana prompts', () => {
    const inputs = buildNanoBananaInputs(
      shotPlan,
      templates,
      {
        model: 'gemini-3.1-flash-image-preview',
      },
    );

    expect(inputs.firstFrameInputs).toHaveLength(1);
    expect(inputs.firstFrameInputs[0]?.prompt).toContain('tight improvised coding desk');
    expect(inputs.firstFrameInputs[0]?.prompt).toContain('raw handheld realism');
    expect(inputs.firstFrameInputs[0]?.prompt).toContain('Wider framing');
    expect(inputs.firstFrameInputs[0]?.prompt).toContain('available light only');
  });

  it('injects scene and capture contract language into Veo prompts', () => {
    const inputs = buildVeoInputs(
      shotPlan,
      templates,
      {
        model: 'veo-3.1-lite-generate-preview',
        resolution: '720p',
        durationSeconds: 8,
        personGeneration: 'allow_adult',
      },
    );

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.request.prompt).toContain('tight improvised coding desk');
    expect(inputs[0]?.request.prompt).toContain('raw handheld realism');
    expect(inputs[0]?.request.prompt).toContain('Wider framing');
    expect(inputs[0]?.request.prompt).toContain('no ad polish');
    expect(inputs[0]?.request.prompt).toContain('chair creak');
  });
});
