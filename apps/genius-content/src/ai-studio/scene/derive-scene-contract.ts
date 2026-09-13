import type {ScriptRecord} from '../shots/types.js';

import type {SceneContract} from './types.js';

const classifyContentArchetype = (script: ScriptRecord) => {
  if (script.beats.length === 4 && script.beats[0]?.speaker !== script.beats[1]?.speaker) {
    return 'debate / confrontation';
  }

  return 'confession to camera';
};

const chooseSceneArchetype = (script: ScriptRecord) => {
  const source = `${script.conflict_id} ${script.viral_goal}`.toLowerCase();

  if (source.includes('cleanup') || source.includes('limit') || source.includes('code')) {
    return 'cramped late-night desk';
  }

  if (source.includes('platform') || source.includes('slop')) {
    return 'glassy corporate corridor';
  }

  return 'messy creator apartment';
};

const buildLocationType = (sceneArchetype: string) => {
  switch (sceneArchetype) {
    case 'cramped late-night desk':
      return 'tight improvised coding desk in a messy apartment corner';
    case 'glassy corporate corridor':
      return 'sterile corporate hallway with reflections, glass walls, and dead air';
    default:
      return 'messy creator apartment workspace with improvised recording setup';
  }
};

export const deriveSceneContract = (script: ScriptRecord): {sceneContract: SceneContract; sceneRationale: string} => {
  const sceneArchetype = chooseSceneArchetype(script);
  const contentArchetype = classifyContentArchetype(script);
  const cleanupLike = `${script.conflict_id} ${script.viral_goal}`.toLowerCase().includes('cleanup');

  const sceneContract: SceneContract = {
    angle: script.conflict_id,
    painPoint: cleanupLike
      ? 'AI speeds up output but creates a cleanup and verification burden.'
      : script.viral_goal,
    contentArchetype,
    sceneArchetype,
    locationType: buildLocationType(sceneArchetype),
    timeOfDay: cleanupLike ? 'late evening' : 'overcast afternoon',
    weather: cleanupLike ? 'light rain outside the window' : 'flat gray daylight',
    lightingQuality: cleanupLike
      ? 'mixed monitor glow and weak practical lamp spill'
      : 'uneven practical office light with natural spill',
    cameraBehavior: cleanupLike ? 'close handheld with visible micro-jitter' : 'social-video handheld realism',
    chaosLevel: cleanupLike ? 'medium-high' : 'medium',
    ambientActivity: cleanupLike
      ? 'keyboard taps, chair creaks, laptop fan, distant HVAC'
      : 'room tone, distant footsteps, light HVAC, occasional object rustle',
    surfaceTexture: cleanupLike
      ? 'worn desk, dusty peripherals, fingerprints on the screen'
      : 'scuffed surfaces, fingerprints, cables, imperfect glass reflections',
    wardrobePressure: cleanupLike
      ? 'unstyled casual work clothes after a long session'
      : 'unstyled everyday clothes matching a normal workday',
    propFamily: cleanupLike
      ? 'cables, sticky notes, cold coffee, half-open laptop, messy notebook'
      : 'everyday work clutter, worn devices, paper scraps, half-used accessories',
    visualTension: cleanupLike
      ? 'overload and friction building inside a cramped workspace'
      : 'social tension inside a visually imperfect real environment',
    shotDeltaPolicy: 'keep the same room and pressure, only tighten framing or body language per beat',
    previewBeat: cleanupLike
      ? 'Elena calling out the cleanup tax while the desk chaos frames the point.'
      : 'One character landing the core conflict inside a raw, believable environment.',
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
        'no luxury production design',
      ],
    },
  };

  return {
    sceneContract,
    sceneRationale: `The ${sceneArchetype} world matches ${sceneContract.painPoint.toLowerCase()} and keeps the reel grounded in raw-footage pressure instead of polished ad energy.`,
  };
};
