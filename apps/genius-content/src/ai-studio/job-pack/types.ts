export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {[key: string]: JsonValue};
export type JsonInputValue = JsonPrimitive | JsonInputValue[] | {[key: string]: JsonInputValue | undefined};

export type JobPackWarningSeverity = 'warning' | 'error';

export interface JobPackWarning {
  code: string;
  message: string;
  severity: JobPackWarningSeverity;
}

export interface JobPackReferenceAsset {
  relativePath: string;
  absolutePath: string;
}

export interface JobPackPersonaRecord {
  displayName: string;
  references: JobPackReferenceAsset[];
  [key: string]: JsonInputValue | JobPackReferenceAsset[] | string | undefined;
}

export interface JobPackPersonaManifest {
  personGeneration?: string;
  personas: Record<string, JobPackPersonaRecord>;
  [key: string]: JsonInputValue | Record<string, JobPackPersonaRecord> | string | undefined;
}

export interface JobPackScriptBeat {
  shotId: string;
  persona: string;
  line: string;
  start?: string;
  end?: string;
  [key: string]: JsonInputValue | string | undefined;
}

export interface JobPackScriptRecord {
  script_id: string;
  conflict_id?: string;
  viral_goal?: string;
  beats: JobPackScriptBeat[];
  [key: string]: JsonInputValue | JobPackScriptBeat[] | string | undefined;
}

export interface JobPackAudioNotes {
  dialogueTemplate?: string;
  ambientTemplate?: string;
  notes?: string[];
}

export interface JobPackEditBrief {
  summary: string;
  assemblyOrder: string[];
}

export interface JobPackSceneContract {
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
  captureContract: {
    format: string;
    rules: string[];
  };
}

export interface JobPackShotInput {
  shotId: string;
  shotIndex: number;
  shotKey: string;
  slug: string;
  personaId: string;
  personaDisplayName: string;
  frameMode: string;
  promptText: string;
  dialogueText: string;
  shot: JsonInputValue;
  sceneDelta?: string;
  nanoBananaFirst: JsonInputValue;
  nanoBananaLast?: JsonInputValue;
  veoRequest: JsonInputValue;
}

export interface JobPackWriteInput {
  jobId: string;
  scriptId: string;
  createdAt: string;
  sourcePath: string;
  outputRoot: string;
  strict: boolean;
  warnings?: JobPackWarning[];
  script: JobPackScriptRecord;
  personas: JobPackPersonaManifest;
  audioNotes: JobPackAudioNotes;
  editBrief: JobPackEditBrief;
  sceneContract: JobPackSceneContract;
  sceneRationale: string;
  previewPrompt: string;
  shots: JobPackShotInput[];
}

export interface WriteJobPackOptions {
  overwrite?: boolean;
}

export interface JobPackWriteResult {
  jobRoot: string;
  filePaths: string[];
}
