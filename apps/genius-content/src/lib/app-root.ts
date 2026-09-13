import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = path.resolve(appRoot, '..', '..');

export const resolveContentRoot = (...segments: string[]) => path.resolve(appRoot, ...segments);

export const resolveWorkspaceRoot = (...segments: string[]) => path.resolve(workspaceRoot, ...segments);

export const resolveFromContentOrAbsolute = (targetPath: string) =>
  path.isAbsolute(targetPath) ? targetPath : resolveContentRoot(targetPath);

export const resolveFromWorkspaceOrAbsolute = (targetPath: string) =>
  path.isAbsolute(targetPath) ? targetPath : resolveWorkspaceRoot(targetPath);
