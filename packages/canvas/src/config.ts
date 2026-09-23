import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {CanvasConfig, CanvasConfigInput} from './types.js';

const DEFAULT_PORT = 4188;
const packageRootFromModule = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRootFromModule = path.resolve(packageRootFromModule, '..', '..');

export const createCanvasConfig = (input: CanvasConfigInput = {}): CanvasConfig => {
  const workspaceRoot = path.resolve(input.workspaceRoot ?? workspaceRootFromModule);
  const packageRoot = path.resolve(
    input.packageRoot ?? packageRootFromModule,
  );
  const publicRoot = path.resolve(input.publicRoot ?? path.join(packageRoot, 'public'));
  const analysisRoot = path.resolve(
    input.analysisRoot ?? path.join(workspaceRoot, 'apps', 'genius-content', 'output', 'analysis'),
  );
  const videoRoot = path.resolve(
    input.videoRoot ?? path.join(workspaceRoot, 'apps', 'genius-content', 'public', 'input'),
  );
  const scaleCalendarPath = path.resolve(
    input.scaleCalendarPath ?? path.join(workspaceRoot, 'apps', 'genius-scale', 'output', 'calendar.json'),
  );
  const geniusBrainsDataRoot = path.resolve(
    input.geniusBrainsDataRoot ?? (process.env.GENIUS_BRAINS_DATA_ROOT?.trim() || path.join(workspaceRoot, 'apps', 'genius-brains', 'output', 'viral')),
  );

  return {
    workspaceRoot,
    packageRoot,
    publicRoot,
    analysisRoot,
    videoRoot,
    scaleCalendarPath,
    geniusBrainsDataRoot,
    port: input.port ?? DEFAULT_PORT,
  };
};
