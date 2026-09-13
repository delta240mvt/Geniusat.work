import path from 'node:path';

import type {CanvasConfig} from './types.js';

const resolveInside = (root: string, relativePath: string) => {
  const targetPath = path.resolve(root, relativePath);
  const relativeTarget = path.relative(root, targetPath);

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeTarget)
  ) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }

  if (relativeTarget.split(/[\\/]/).some(part =>
    part.startsWith('.') || /^(?:credentials|secrets?|service[-_]account)(?:[._-]|$)/i.test(part)
    || /\.(?:pem|key|p12|pfx)$/i.test(part))) {
    throw new Error('This file is not available in the preview.');
  }
  return targetPath;
};

const sanitizePathname = (pathname: string) => decodeURIComponent(pathname).replace(/^\/+/, '');

export const resolveRequestPath = (pathname: string, config: CanvasConfig) => {
  if (pathname === '/api/analysis-list') {
    throw new Error('Listing endpoint does not map to a file');
  }

  if (pathname.startsWith('/api/analysis/')) {
    const relativePath = sanitizePathname(pathname.slice('/api/analysis/'.length));
    return resolveInside(config.analysisRoot, relativePath);
  }

  if (pathname.startsWith('/api/video/')) {
    const relativePath = sanitizePathname(pathname.slice('/api/video/'.length));
    return resolveInside(config.videoRoot, relativePath);
  }

  if (pathname.startsWith('/api/workspace/')) {
    const relativePath = sanitizePathname(pathname.slice('/api/workspace/'.length));
    const resolved = resolveInside(config.workspaceRoot, relativePath);
    const normalized = path.relative(config.workspaceRoot, resolved).replaceAll('\\', '/');
    if (!/^apps\/genius-(?:content|brains|scale)\/(?:output|input|public|AI Studio)\//.test(normalized)) {
      throw new Error('Only project media and artifacts are available in the preview.');
    }
    return resolved;
  }

  if (pathname === '/') {
    return path.join(config.publicRoot, 'index.html');
  }

  return resolveInside(config.publicRoot, sanitizePathname(pathname));
};
