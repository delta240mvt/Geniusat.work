import fs from 'node:fs/promises';
import path from 'node:path';

import type {AiStudioConfig} from '../config/load-config.js';

export type AiStudioPersonGeneration = 'allow_adult' | 'dont_allow';

export type AiStudioPersonaVoiceInput = {
  timbre?: string | null;
  cadence?: string | null;
  mouthMovement?: string | null;
  acousticEnvironment?: string | null;
};

export type AiStudioPersonaInput = {
  displayName: string;
  references: string[];
  identity: string[];
  negativeConstraints?: string[];
  voice?: AiStudioPersonaVoiceInput;
};

export type ResolvePersonasInput = {
  contentRoot: string;
  personas: {
    personas: Record<string, AiStudioPersonaInput>;
  };
  models?: {
    veo?: {
      personGeneration?: AiStudioPersonGeneration;
    };
  };
};

export type ResolvedPersonaReference = {
  relativePath: string;
  absolutePath: string;
};

export type ResolvedPersonaVoice = {
  timbre: string | null;
  cadence: string | null;
  mouthMovement: string | null;
  acousticEnvironment: string | null;
};

export type ResolvedPersona = {
  id: string;
  displayName: string;
  references: ResolvedPersonaReference[];
  canonicalRefs: {
    all: ResolvedPersonaReference[];
    nanoBanana: ResolvedPersonaReference[];
    veo: ResolvedPersonaReference[];
  };
  identityAnchors: string[];
  negativeConstraints: string[];
  promptAnchors: {
    identity: string[];
    negativeConstraints: string[];
    adultGuardLine: string;
  };
  voice: ResolvedPersonaVoice;
  voiceProfile: ResolvedPersonaVoice;
  futureVoice: {
    timbreProfile: string | null;
    cadenceProfile: string | null;
    mouthMovementConstraints: string | null;
    acousticEnvironmentNotes: string | null;
  };
  personGeneration: AiStudioPersonGeneration;
  regionPolicy: {
    veoPersonGeneration: AiStudioPersonGeneration;
  };
  isAdult: boolean;
};

export type ResolvedPersonas = {
  personGeneration: AiStudioPersonGeneration;
  veoReferenceLimit: number;
  personas: Record<string, ResolvedPersona>;
};

export type ResolvedPersonaLibrary = Record<string, ResolvedPersona>;

const VEO_REFERENCE_LIMIT = 3;

const ensureFileExists = async (absolutePath: string) => {
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Persona reference does not exist: ${absolutePath}`);
  }
};

const resolveReference = async (contentRoot: string, relativePath: string): Promise<ResolvedPersonaReference> => {
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.resolve(contentRoot, relativePath);
  await ensureFileExists(absolutePath);

  return {
    relativePath,
    absolutePath,
  };
};

const resolveVoice = (voice: AiStudioPersonaVoiceInput | undefined): ResolvedPersonaVoice => ({
  timbre: voice?.timbre ?? null,
  cadence: voice?.cadence ?? null,
  mouthMovement: voice?.mouthMovement ?? null,
  acousticEnvironment: voice?.acousticEnvironment ?? null,
});

const buildAdultGuardLine = (displayName: string) =>
  `Always depict ${displayName} as an adult character; never imply a minor or childlike age.`;

const buildResolvedPersona = ({
  id,
  displayName,
  references,
  identityAnchors,
  negativeConstraints,
  voice,
  personGeneration,
}: {
  id: string;
  displayName: string;
  references: ResolvedPersonaReference[];
  identityAnchors: string[];
  negativeConstraints: string[];
  voice: ResolvedPersonaVoice;
  personGeneration: AiStudioPersonGeneration;
}): ResolvedPersona => {
  const canonicalRefs = {
    all: references,
    nanoBanana: references,
    veo: references.slice(0, VEO_REFERENCE_LIMIT),
  };

  return {
    id,
    displayName,
    references,
    canonicalRefs,
    identityAnchors,
    negativeConstraints,
    promptAnchors: {
      identity: identityAnchors,
      negativeConstraints,
      adultGuardLine: buildAdultGuardLine(displayName),
    },
    voice,
    voiceProfile: voice,
    futureVoice: {
      timbreProfile: null,
      cadenceProfile: null,
      mouthMovementConstraints: null,
      acousticEnvironmentNotes: null,
    },
    personGeneration,
    regionPolicy: {
      veoPersonGeneration: personGeneration,
    },
    isAdult: personGeneration === 'allow_adult' || identityAnchors.some((anchor) => /adult/i.test(anchor)),
  };
};

export const resolvePersonas = async (input: ResolvePersonasInput): Promise<ResolvedPersonas> => {
  const personGeneration = input.models?.veo?.personGeneration ?? 'allow_adult';
  const entries = await Promise.all(
    Object.entries(input.personas.personas).map(async ([id, persona]) => {
      const references = await Promise.all(persona.references.map((referencePath) => resolveReference(input.contentRoot, referencePath)));

      return [
        id,
        buildResolvedPersona({
          id,
          displayName: persona.displayName,
          references,
          identityAnchors: [...persona.identity],
          negativeConstraints: [...(persona.negativeConstraints ?? [])],
          voice: resolveVoice(persona.voice),
          personGeneration,
        }),
      ] as const;
    }),
  );

  return {
    personGeneration,
    veoReferenceLimit: VEO_REFERENCE_LIMIT,
    personas: Object.fromEntries(entries),
  };
};

export const resolvePersonaLibrary = (config: AiStudioConfig): ResolvedPersonaLibrary =>
  Object.fromEntries(
    Object.entries(config.personas.personas).map(([id, persona]) => {
      const references = persona.referenceImages.map((reference) => ({
        relativePath: reference.path,
        absolutePath: reference.absolutePath,
      }));

      return [
        id,
        buildResolvedPersona({
          id,
          displayName: persona.displayName,
          references,
          identityAnchors: [...persona.identity],
          negativeConstraints: [...persona.negativeConstraints],
          voice: resolveVoice(persona.voice),
          personGeneration: config.models.veo.personGeneration,
        }),
      ] as const;
    }),
  );
