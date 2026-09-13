export type PersonaId = 'zoe' | 'elena' | string;

export interface ScriptBeat {
  key: string;
  index: number;
  speaker: PersonaId;
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
  title: string;
  script_id: string;
  conflict_id: string;
  viral_goal: string;
  beats: [ScriptBeat, ScriptBeat, ScriptBeat, ScriptBeat];
  sourcePath: string;
}

export interface ScriptLibrary {
  sourcePath: string;
  scriptIds: string[];
  scripts: ScriptRecord[];
}

export interface ParseViralityScriptsOptions {
  sourcePath: string;
  strict?: boolean;
}

export type ViralityScriptRecord = ScriptRecord;
export type ViralityScriptLibrary = ScriptLibrary;
