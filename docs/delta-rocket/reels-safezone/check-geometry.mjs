import puppeteer from 'puppeteer-core';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();await page.setViewport({width:1080,height:1920});
const failures=[];
for(let n=1;n<=3;n++){
 const id=`delta-modele-ai-concept-${n}`;
 await page.goto(pathToFileURL(path.resolve(`apps/genius-content/public/reels/${id}/index.html`)).href);
 await page.evaluate(async()=>{await document.fonts.ready;});
 for(let f=0;f<498;f++){
  const errors=await page.evaluate(({id,t})=>{
   window.__timelines[id].totalTime(t,true);
   const errors=[];
   for(const el of document.querySelectorAll('.safe-title,.safe-captions span,.safe-art path,.safe-art circle')){
    const r=el.getBoundingClientRect();
    if(r.left<120||r.right>880||r.top<300||r.bottom>1600)errors.push(`${el.tagName}: ${[r.left,r.top,r.right,r.bottom]}`);
   }
   const video=document.querySelector('video').getBoundingClientRect();
   if(video.x!==0||video.y!==0||video.width!==1080||video.height!==1920)errors.push('video not full frame');
   const title=document.querySelector('.safe-title');
   if(title.scrollWidth>title.clientWidth)errors.push('title overflow');
   const cap=document.querySelector('.safe-captions');
   if(cap&&cap.firstElementChild.getBoundingClientRect().height>112)errors.push('caption exceeds two lines');
   return errors;
  },{id,t:f/30});
  if(errors.length)failures.push({n,f,errors});
 }
 await page.evaluate(async({id})=>{const video=document.querySelector('video');video.currentTime=5.8;await new Promise(r=>video.addEventListener('seeked',r,{once:true}));window.__timelines[id].totalTime(5.8,true);},{id});
 await page.screenshot({path:`docs/delta-rocket/reels-safezone/concept-${n}.png`});
}
await writeFile('docs/delta-rocket/reels-safezone/geometry.json',JSON.stringify({frames:1494,failures},null,2));
await browser.close();console.log(JSON.stringify({frames:1494,failures:failures.slice(0,5),count:failures.length}));
if(failures.length)process.exitCode=1;
