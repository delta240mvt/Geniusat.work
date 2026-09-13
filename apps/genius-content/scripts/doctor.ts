import {readHealth} from '../../../packages/canvas/src/health.js';
import {resolveWorkspaceRoot} from '../src/lib/app-root.js';

const health = await readHealth(resolveWorkspaceRoot());
console.log(JSON.stringify(health, null, 2));
if (health.checks.some(check => !check.ready)) process.exitCode = 1;
