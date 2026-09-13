#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const binDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(binDir, '..');
const entrypoint = resolve(packageRoot, 'src', 'cli', 'index.ts');

const result = spawnSync(process.execPath, ['--import', 'tsx', entrypoint, ...process.argv.slice(2)], {
  cwd: packageRoot,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
