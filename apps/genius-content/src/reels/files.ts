import {mkdir, readFile, writeFile, readdir, copyFile, stat, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {reelSchema, reelDuration, type Reel} from './model.js';
import {escapeHtml, FONT_CSS, VISUAL_CSS, frameMarkup} from './visual.js';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const workspaceRoot = path.resolve(appRoot,'../..');
export const publicRoot = path.join(appRoot,'public');
export const reelsRoot = path.join(appRoot,'reels');
export const require = createRequire(import.meta.url);
export async function loadReel(id: string): Promise<Reel> {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new Error('Niepoprawny identyfikator rolki.');
  const saved = JSON.parse(await readFile(path.join(reelsRoot,`${id}.json`),'utf8'));
  // Existing projects retain their scenes and timing after the renderer migration.
  return reelSchema.parse({...saved, preferredEngine: 'hyperframes'});
}
export async function saveReel(input: Reel) {
  const reel = reelSchema.parse(input);
  await mkdir(reelsRoot,{recursive:true});
  const target = path.join(reelsRoot,`${reel.id}.json`);
  const temp = `${target}.tmp`;
  await writeFile(temp,JSON.stringify(reel,null,2)+'\n');
  await rename(temp,target);
  return reel;
}
export async function listReels(): Promise<Reel[]> {
  const names = await readdir(reelsRoot).catch(()=>[]);
  return Promise.all(names.filter(n=>n.endsWith('.json')).map(n=>loadReel(n.slice(0,-5))));
}
export async function exists(file: string) {return stat(file).then(s=>s.size>0,()=>false);}
export async function run(command: string, args: string[], onLine: (s: string)=>void = console.log, cwd = appRoot): Promise<void> {
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(command,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let tail='';
    const receive=(chunk: Buffer)=>{tail=(tail+chunk.toString()).slice(-5000); onLine(chunk.toString());};
    child.stdout.on('data',receive); child.stderr.on('data',receive);
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error(`${path.basename(command)} zakończył pracę (${code}). ${tail.slice(-2500)}`)));
  });
}
export async function prepareReel(reel: Reel, report: (s:string)=>void = console.log) {
  const dir = path.join(publicRoot,'reels',reel.id);
  await mkdir(dir,{recursive:true});
  const source = path.join(publicRoot,'input',reel.sourceFile);
  if (!await exists(source)) throw new Error(`Brak nagrania w bibliotece: ${reel.sourceFile}`);
  const sourceStat = await stat(source);
  const cacheKey=JSON.stringify({clips:reel.clips,source:reel.sourceFile,size:sourceStat.size,mtime:sourceStat.mtimeMs,version:4});
  const oldKey=await readFile(path.join(dir,'source-key.txt'),'utf8').catch(()=>'');
  if (oldKey!==cacheKey || !await exists(path.join(dir,'source.mp4'))) {
    report('Przygotowanie nagrania i dźwięku…');
    const {stdout}=await promisify(execFile)('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=color_transfer','-of','json',source],{windowsHide:true});
    const hdr=['arib-std-b67','smpte2084'].includes(JSON.parse(stdout).streams?.[0]?.color_transfer);
    const color=hdr?'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0:peak=10,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,':'format=yuv420p,';
    const filters = reel.clips.map((c,i)=>`[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${color}setsar=1,fps=30[v${i}];[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0,c.end-c.start-.018)}:d=0.018[a${i}]`).join(';')+';'+reel.clips.map((_,i)=>`[v${i}][a${i}]`).join('')+`concat=n=${reel.clips.length}:v=1:a=1[v][audio];[audio]loudnorm=I=-16:TP=-1.5:LRA=9[a]`;
    const temporary = path.join(dir,'source-pending.mp4');
    await run('ffmpeg',['-y','-v','error','-i',source,'-filter_complex',filters,'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart',temporary],report);
    await rename(temporary,path.join(dir,'source.mp4'));
    await writeFile(path.join(dir,'source-key.txt'),cacheKey);
  }
  await mkdir(path.join(dir,'fonts'),{recursive:true});
  for(const name of await readdir(path.join(publicRoot,'fonts'))) await copyFile(path.join(publicRoot,'fonts',name),path.join(dir,'fonts',name));
  await build({entryPoints:[path.join(appRoot,'src/reels/browser.ts')],bundle:true,format:'iife',platform:'browser',outfile:path.join(dir,'motion.js'),minify:true,logLevel:'silent'});
  const json=JSON.stringify(reel).replaceAll('<','\\u003c');
  const html=`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(reel.title)}</title><style>${FONT_CSS}${VISUAL_CSS}html,body{margin:0;overflow:hidden;background:#F8F7F3}#stage{transform-origin:top left}video{display:block}</style></head><body><div id="stage" class="d240-stage" data-composition-id="${reel.id}" data-start="0" data-duration="${reelDuration(reel)}" data-width="1080" data-height="1920" data-fps="30"><video id="footage" class="clip d240-video" data-start="0" data-duration="${reelDuration(reel)}" data-track-index="0" src="source.mp4" playsinline preload="auto"></video><div id="graphics" class="clip" data-start="0" data-duration="${reelDuration(reel)}" data-track-index="1">${frameMarkup(reel,0)}</div></div><script type="application/json" id="reel-data">${json}</script><script src="motion.js"></script></body></html>`;
  await writeFile(path.join(dir,'index.html'),html
    .replace('src="source.mp4"', 'src="source.mp4" data-has-audio="true"')
    .replace('<script src="motion.js">','<script>window.__timelines = window.__timelines || {};</script><script src="motion.js">'));
  await writeFile(path.join(dir,'reel.json'),JSON.stringify(reel,null,2));
  await writeFile(path.join(dir,'hyperframes.json'),JSON.stringify({name:reel.id},null,2));
  report('Projekt gotowy do podglądu.');
  return dir;
}
