import {describe, expect, it} from 'vitest';

import {buildShotPlan} from '../../src/ai-studio/shots/build-shot-plan.js';
import type {
  ResolvedPersona,
  ScriptRecord,
  ShotConfig,
} from '../../src/ai-studio/shots/types.js';

const scriptRecord: ScriptRecord = {
  script_id: 'ide_war',
  conflict_id: 'ide_war',
  viral_goal: 'Trigger tribal tool arguments',
  beats: [
    {
      key: 'zoe_open',
      speaker: 'zoe',
      startTime: '0:00',
      endTime: '0:04',
      dialogue: 'Cursor Pro robi za mnie wszystko.',
      delivery: 'cocky selfie energy',
      emotion: 'smug excitement',
      ambience: 'soft keyboard clicks',
      sfx: 'subtle notification ping',
    },
    {
      key: 'elena_response',
      speaker: 'elena',
      startTime: '0:04',
      endTime: '0:11',
      dialogue: 'Placisz premium za literowki i stare API.',
      delivery: 'dry webcam realism',
      emotion: 'skeptical precision',
      ambience: 'computer fan hum',
      sfx: 'mug tap on desk',
    },
    {
      key: 'zoe_reaction',
      speaker: 'zoe',
      startTime: '0:11',
      endTime: '0:13',
      dialogue: 'Dobra... akurat dzis zjadlo mi limit.',
      delivery: 'deflated confession',
      emotion: 'embarrassed panic',
      ambience: 'room tone',
      sfx: 'awkward inhale',
    },
    {
      key: 'elena_cta',
      speaker: 'elena',
      startTime: '0:13',
      endTime: '0:15',
      dialogue: 'Po wiecej takiej terapii grupowej, follow.',
      delivery: 'deadpan closer',
      emotion: 'calm superiority',
      ambience: 'quiet office hum',
      sfx: 'chair creak',
      cta: 'Po wiecej takiej terapii grupowej, follow.',
    },
  ],
};

const personas: ResolvedPersona[] = [
  {
    id: 'zoe',
    displayName: 'Zoe',
    referenceImagePaths: ['AI Studio/Zoe_base.png', 'AI Studio/Zoe_round.png'],
    identityAnchors: ['23-year-old adult vibe coder', 'warm selfie desk setup'],
    negativeConstraints: ['no corporate ad look'],
    voiceProfile: {
      timbre: 'bright',
      cadence: 'fast',
      mouthMovement: 'energetic',
      acousticEnvironment: 'warm bedroom office',
    },
    veoReferenceImagePaths: ['AI Studio/Zoe_base.png', 'AI Studio/Zoe_round.png'],
  },
  {
    id: 'elena',
    displayName: 'Elena',
    referenceImagePaths: ['AI Studio/Elena_base.png', 'AI Studio/Elena_round.png'],
    identityAnchors: ['36-year-old adult senior engineer', 'cool webcam realism'],
    negativeConstraints: ['no glam influencer look'],
    voiceProfile: {
      timbre: 'low dry alto',
      cadence: 'measured',
      mouthMovement: 'minimal',
      acousticEnvironment: 'dim monitor-lit office',
    },
    veoReferenceImagePaths: ['AI Studio/Elena_base.png', 'AI Studio/Elena_round.png'],
  },
];

const shotConfig: ShotConfig = {
  aspectRatio: '9:16',
  imageSize: '1080x1920',
  defaultLanguage: 'pl',
  nanoBanana: {
    model: 'gemini-3.1-flash-image-preview',
  },
  veo: {
    model: 'veo-3.1-lite-generate-preview',
    resolution: '1080x1920',
    durationSeconds: 8,
    personGeneration: 'allow_adult',
  },
  shotOrder: [
    {
      key: 'zoe_open',
      slug: '01-zoe-open',
      frameMode: 'first_only',
      activePersonaId: 'zoe',
      camera: 'front camera handheld selfie',
      motion: 'subtle handheld bobbing',
    },
    {
      key: 'elena_response',
      slug: '02-elena-response',
      frameMode: 'first_only',
      activePersonaId: 'elena',
      camera: 'static webcam close shot',
      motion: 'still frame with eyebrow raise',
    },
    {
      key: 'zoe_reaction',
      slug: '03-zoe-reaction',
      frameMode: 'first_and_last',
      activePersonaId: 'zoe',
      camera: 'slight push-in reaction close-up',
      motion: 'confidence collapse into awkward pause',
    },
    {
      key: 'elena_cta',
      slug: '04-elena-cta',
      frameMode: 'first_and_last',
      activePersonaId: 'elena',
      camera: 'locked webcam punchline close shot',
      motion: 'small lean-in before the CTA',
    },
  ],
};

describe('buildShotPlan', () => {
  it('maps one script into four deterministic shots in fixed order', () => {
    const plan = buildShotPlan(scriptRecord, personas, shotConfig);

    expect(plan.scriptId).toBe('ide_war');
    expect(plan.shots).toHaveLength(4);
    expect(plan.shots.map((shot) => shot.key)).toEqual([
      'zoe_open',
      'elena_response',
      'zoe_reaction',
      'elena_cta',
    ]);
  });

  it('applies the fixed frame modes and active persona sequence', () => {
    const plan = buildShotPlan(scriptRecord, personas, shotConfig);

    expect(plan.shots.map((shot) => shot.frameMode)).toEqual([
      'first_only',
      'first_only',
      'first_and_last',
      'first_and_last',
    ]);
    expect(plan.shots.map((shot) => shot.activePersonaId)).toEqual([
      'zoe',
      'elena',
      'zoe',
      'elena',
    ]);
  });

  it('attaches the CTA only to the fourth shot', () => {
    const plan = buildShotPlan(scriptRecord, personas, shotConfig);

    expect(plan.shots.map((shot) => shot.ctaText ?? null)).toEqual([
      null,
      null,
      null,
      'Po wiecej takiej terapii grupowej, follow.',
    ]);
    expect(plan.shots[0]?.firstFrameArtifactName).toBe('nano-banana-first.json');
    expect(plan.shots[2]?.lastFrameArtifactName).toBe('nano-banana-last.json');
  });
});
