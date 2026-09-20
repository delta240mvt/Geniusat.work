import {copyFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {loadReel,saveReel,prepareReel,publicRoot} from '../src/reels/files.js';
import {renderReel} from '../src/reels/render.js';
const source=await loadReel('delta-modele-ai');
await prepareReel(source);
for(const [index,motionConcept] of (['interface','metaphor','transformation'] as const).entries()) {
  const reel={...source,id:`delta-modele-ai-concept-${index+1}`,title:`${index+1}. ${['Żywy interfejs','Metafora w ruchu','Interfejs przechodzi w efekt'][index]}`,motionConcept};
  const dir=path.join(publicRoot,'reels',reel.id);
  await mkdir(dir,{recursive:true});
  for(const file of ['source.mp4','source-key.txt']) await copyFile(path.join(publicRoot,'reels',source.id,file),path.join(dir,file));
  await saveReel(reel);
  if(process.argv.includes('--prepare'))await prepareReel(reel);
  else await renderReel(reel);
}
