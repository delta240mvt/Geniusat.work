import {readFileSync} from 'node:fs';
import path from 'node:path';

import {resolveContentRoot} from '../../lib/app-root.js';
import {parseViralityScripts} from './parse-virality-scripts.js';

export const viralityScriptsSourcePath = path.normalize(
  'AI Studio/virality/Tworzenie Person AI do Promocji Memów.md',
);

export const viralityScriptsSourceFile = resolveContentRoot(viralityScriptsSourcePath);

export const loadScriptLibrary = (sourceFile = viralityScriptsSourceFile) => {
  const markdown = readFileSync(sourceFile, 'utf8');

  return parseViralityScripts(markdown, {
    sourcePath: path.relative(resolveContentRoot(), sourceFile),
    strict: true,
  });
};

export const loadViralityScriptLibrary = loadScriptLibrary;
