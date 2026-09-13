import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {runTranscriptStage} from '../src/lib/transcript-stage.js';
import {resolveFromContentOrAbsolute} from '../src/lib/app-root.js';

export const main = async (argv: string[]) => {
  const firstArg = argv.find((arg) => !arg.startsWith('--'));

  if (!firstArg) {
    throw new Error('An input video path is required.');
  }

  const inputPath = resolveFromContentOrAbsolute(firstArg);
  return runTranscriptStage({inputPath});
};

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main(process.argv.slice(2))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
