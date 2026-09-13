import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import path from 'node:path';
import {createReel} from '../src/reels/model.js';
import {appRoot, saveReel, loadReel, prepareReel} from '../src/reels/files.js';
import {renderReel} from '../src/reels/render.js';
import {readTranscript} from '../src/reels/transcripts.js';
import {runTranscriptStage} from '../src/lib/transcript-stage.js';

const jobSchema=z.object({action:z.enum(['create','save','prepare','render']),id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  sourceId:z.string().regex(/^[a-z0-9-]+$/).optional(),sourceFile:z.string().regex(/^[\w.-]+\.(mov|mp4)$/i).optional(),
  title:z.string().min(1).max(100).optional(),duration:z.number().positive().max(1800).optional(),
  style:z.enum(['editorial','signal']).optional(),engine:z.literal('hyperframes').optional(),scenes:z.unknown().optional()});
try {
  const job=jobSchema.parse(JSON.parse(await readFile(process.argv[2],'utf8')));
  let reel;
  if(job.action==='create') {
    if(!job.sourceId||!job.sourceFile||!job.duration||!job.title) throw new Error('Brakuje danych nagrania.');
    let speech = await readTranscript(job.sourceId);
    if (!speech) {
      console.log('Tworzenie napisów lokalnie. Pierwsze uruchomienie może potrwać kilka minut…');
      const transcript = await runTranscriptStage({inputPath: path.join(appRoot, 'public/input', job.sourceFile)});
      speech = transcript.speech;
    }
    if (!speech.some(segment => segment.words.length)) throw new Error('Nie wykryto mowy w nagraniu. Wybierz materiał z wypowiedzią.');
    reel=await saveReel(createReel({id:job.id,sourceId:job.sourceId,sourceFile:job.sourceFile,title:job.title,duration:job.duration,speech,style:job.style}));
  } else {
    reel=await loadReel(job.id);
    if(job.action==='save') reel=await saveReel({...reel,title:job.title??reel.title,style:job.style??reel.style,scenes:(job.scenes??reel.scenes) as typeof reel.scenes});
  }
  if(job.action==='render') await renderReel(reel);
  else await prepareReel(reel);
} catch(error) {
  console.error(error instanceof z.ZodError
    ? 'Sprawdź dane projektu: ' + error.issues.slice(0, 3).map(issue => issue.message).join(' ')
    : error instanceof Error ? error.message : error);
  process.exitCode=1;
}
