import {readFile} from 'node:fs/promises';

import {projectConfigSchema, type ProjectConfig} from '../types/analysis.js';
import {resolveProjectConfigPath} from './paths.js';

export const loadProjectConfig = async (
  configPath = resolveProjectConfigPath(),
): Promise<ProjectConfig> => {
  const raw = await readFile(configPath, 'utf8');
  return projectConfigSchema.parse(JSON.parse(raw));
};
