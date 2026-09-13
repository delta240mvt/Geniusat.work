import path from 'node:path';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import type {Reel} from './model.js';
import {appRoot, require, prepareReel, run} from './files.js';

export async function renderReel(reel: Reel, report: (s:string)=>void = console.log) {
  const engine = 'hyperframes';
  const project=await prepareReel(reel,report);
  const renders=path.join(appRoot,'output/renders');
  await mkdir(renders,{recursive:true});
  const output=path.join(renders,`${reel.id}-${engine}.mp4`);
  const pending=path.join(renders,`${reel.id}-${engine}-pending.mp4`);
  report(`Renderowanie: ${engine}…`);
  const cli=path.join(path.dirname(require.resolve('hyperframes/package.json')),'bin/hyperframes.mjs');
  await run(process.execPath,[cli,'render',project,'--output',pending,'--fps','30','--quality','high','--crf','17','--workers','1','--low-memory-mode','--sdr'],report);
  await rename(pending,output);
  await writeFile(output.replace(/\.mp4$/,'.json'),JSON.stringify({reelId:reel.id,engine,renderedAt:new Date().toISOString(),reel},null,2));
  report(`Gotowe: ${output}`);
  return output;
}
