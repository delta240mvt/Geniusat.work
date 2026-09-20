import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';
import {pathToFileURL} from 'node:url';import path from 'node:path';
const {outputFiles}=await build({entryPoints:['apps/genius-content/src/reels/safe-visual.ts'],bundle:true,format:'iife',globalName:'SafeTest',write:false});
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();await page.setViewport({width:1080,height:1920});
await page.goto(pathToFileURL(path.resolve('apps/genius-content/public/reels/delta-modele-ai-concept-1/index.html')).href);await page.addScriptTag({content:outputFiles[0].text});
const result=await page.evaluate(async()=>{await document.fonts.ready;const reel=JSON.parse(document.querySelector('#reel-data').textContent);reel.scenes[0].title='W'.repeat(90);reel.words=[0,1,2].map(i=>({word:'W'.repeat(11),startMs:i*200,endMs:i*200+200}));document.querySelector('#graphics').innerHTML=SafeTest.safeFrameMarkup(reel,.3);const title=document.querySelector('.safe-title'),cap=document.querySelector('.safe-captions');return {titleWidth:title.clientWidth,titleContent:title.scrollWidth,captionHeight:cap.firstElementChild.getBoundingClientRect().height};});console.log(result);await browser.close();if(result.titleContent>result.titleWidth||result.captionHeight>112)process.exitCode=1;
