import {parseArgs} from 'node:util';
import {featuredReels} from '../src/reels/presets.js';
import {saveReel, loadReel, prepareReel, exists, reelsRoot} from '../src/reels/files.js';
import {renderReel} from '../src/reels/render.js';
import path from 'node:path';
const {values}=parseArgs({options:{seed:{type:'boolean'},id:{type:'string'},engine:{type:'string'},prepare:{type:'boolean'}}});
try {
  if(values.engine && values.engine !== 'hyperframes') throw new Error('Eksport obsługuje wyłącznie Hyperframes.');
  if(values.seed) for(const reel of featuredReels()) {
    if(!await exists(path.join(reelsRoot,`${reel.id}.json`))) await saveReel(reel);
    console.log(`Scenariusz: ${reel.id}`);
  }
  if(values.id) {
    const reel=await loadReel(values.id);
    if(values.prepare) await prepareReel(reel);
    else {
      await renderReel(reel);
    }
  } else if(!values.seed) throw new Error('Podaj --id rolki. --prepare tworzy podgląd; bez tej flagi powstaje MP4 przez Hyperframes.');
} catch(error) {console.error(error instanceof Error?error.message:error);process.exitCode=1;}
