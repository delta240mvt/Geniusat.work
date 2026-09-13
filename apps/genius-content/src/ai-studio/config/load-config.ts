import fs from 'node:fs/promises';
import path from 'node:path';

import {resolveContentRoot} from '../../lib/app-root.js';
import {
  aiStudioModelsConfigSchema,
  aiStudioPersonasConfigSchema,
  aiStudioPromptsConfigSchema,
  aiStudioShotsConfigSchema,
  aiStudioStudioConfigSchema,
  type AiStudioModelsConfig,
  type AiStudioPersonasConfig,
  type AiStudioPromptsConfig,
  type AiStudioShotsConfig,
  type AiStudioStudioConfig,
} from './schema.js';

type LoadAiStudioConfigOptions = {
  contentRoot?: string;
  configRoot?: string;
};

type ConfigFileName =
  | 'studio.config.json'
  | 'models.json'
  | 'personas.json'
  | 'shots.json'
  | 'prompts.json';

type ReferenceAsset = {
  path: string;
  absolutePath: string;
};

type NormalizedPersona = Omit<AiStudioPersonasConfig['personas'][string], 'references'> & {
  id: string;
  referenceImages: ReferenceAsset[];
  references: string[];
};

type LoadedStudioConfig = AiStudioStudioConfig & {
  project: {
    id: 'ai-studio';
    rootAbsolute: string;
  };
  sourceFileAbsolute: string;
  outputRootAbsolute: string;
};

type LoadedModelsConfig = {
  nanoBanana: AiStudioModelsConfig['nanoBanana'];
  veo: AiStudioModelsConfig['veo'];
};

type LoadedShotsConfig = AiStudioShotsConfig & {
  sequence: AiStudioShotsConfig['shotOrder'];
};

type LoadedPromptsConfig = AiStudioPromptsConfig;

export type AiStudioConfig = {
  configRoot?: string;
  studio?: LoadedStudioConfig;
  models: {
    nanoBanana?: AiStudioModelsConfig['nanoBanana'];
    veo: Partial<AiStudioModelsConfig['veo']> & Pick<AiStudioModelsConfig['veo'], 'personGeneration'>;
  };
  personas: {
    personas: Record<string, NormalizedPersona>;
  };
  shots?: LoadedShotsConfig;
  prompts?: LoadedPromptsConfig;
};

export type LoadedAiStudioConfig = {
  configRoot: string;
  studio: LoadedStudioConfig;
  models: LoadedModelsConfig;
  personas: {
    personas: Record<string, NormalizedPersona>;
  };
  shots: LoadedShotsConfig;
  prompts: LoadedPromptsConfig;
};

const readJsonFile = async <T>(filePath: string, parser: {parse: (value: unknown) => T}) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return parser.parse(JSON.parse(raw));
};

const ensureFileExists = async (filePath: string, label: string) => {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`${label} is not a file: ${filePath}`);
    }
  } catch (error) {
    throw new Error(`${label} does not exist: ${filePath}`, {cause: error});
  }
};

const resolveConfigPath = (configRoot: string, fileName: ConfigFileName) => path.join(configRoot, fileName);

export const loadAiStudioConfig = async ({
  contentRoot = resolveContentRoot(),
  configRoot = path.join(contentRoot, 'AI Studio', 'config'),
}: LoadAiStudioConfigOptions = {}): Promise<LoadedAiStudioConfig> => {
  const resolvedContentRoot = path.resolve(contentRoot);
  const resolvedConfigRoot = path.resolve(configRoot);

  const studio = await readJsonFile(
    resolveConfigPath(resolvedConfigRoot, 'studio.config.json'),
    aiStudioStudioConfigSchema,
  );
  const models = await readJsonFile(
    resolveConfigPath(resolvedConfigRoot, 'models.json'),
    aiStudioModelsConfigSchema,
  );
  const personas = await readJsonFile(
    resolveConfigPath(resolvedConfigRoot, 'personas.json'),
    aiStudioPersonasConfigSchema,
  );
  const shots = await readJsonFile(
    resolveConfigPath(resolvedConfigRoot, 'shots.json'),
    aiStudioShotsConfigSchema,
  );
  const prompts = await readJsonFile(
    resolveConfigPath(resolvedConfigRoot, 'prompts.json'),
    aiStudioPromptsConfigSchema,
  );

  const studioWithPaths = {
    ...studio,
    project: {
      id: 'ai-studio' as const,
      rootAbsolute: path.resolve(resolvedContentRoot, 'AI Studio'),
    },
    sourceFileAbsolute: path.resolve(resolvedContentRoot, studio.sourceFile),
    outputRootAbsolute: path.resolve(resolvedContentRoot, studio.outputRoot),
  };

  await ensureFileExists(studioWithPaths.sourceFileAbsolute, 'AI Studio source file');

  const normalizedPersonas = Object.fromEntries(
    Object.entries(personas.personas).map(([personaId, persona]) => {
      const referenceImages = persona.references.map((referencePath) => ({
        path: referencePath,
        absolutePath: path.resolve(resolvedContentRoot, referencePath),
      }));

      return [
        personaId,
        {
          ...persona,
          id: personaId,
          references: [...persona.references],
          referenceImages,
        },
      ];
    }),
  );

  for (const persona of Object.values(normalizedPersonas)) {
    for (const reference of persona.referenceImages) {
      await ensureFileExists(reference.absolutePath, `AI Studio persona reference "${reference.path}"`);
    }
  }

  for (const shotId of shots.shotOrder) {
    if (!shots.definitions[shotId]) {
      throw new Error(`Shot order references undefined shot "${shotId}".`);
    }
  }

  for (const [shotId, shotDefinition] of Object.entries(shots.definitions)) {
    if (!normalizedPersonas[shotDefinition.activePersona]) {
      throw new Error(`Shot "${shotId}" references unknown persona "${shotDefinition.activePersona}".`);
    }
  }

  return {
    configRoot: resolvedConfigRoot,
    studio: studioWithPaths,
    models,
    personas: {
      personas: normalizedPersonas,
    },
    shots: {
      ...shots,
      sequence: shots.shotOrder,
    },
    prompts,
  };
};
