export interface CaptureContract {
  format: string;
  rules: string[];
}

export interface SceneContract {
  angle: string;
  painPoint: string;
  contentArchetype: string;
  sceneArchetype: string;
  locationType: string;
  timeOfDay: string;
  weather: string;
  lightingQuality: string;
  cameraBehavior: string;
  chaosLevel: string;
  ambientActivity: string;
  surfaceTexture: string;
  wardrobePressure: string;
  propFamily: string;
  visualTension: string;
  shotDeltaPolicy: string;
  previewBeat: string;
  captureContract: CaptureContract;
}
