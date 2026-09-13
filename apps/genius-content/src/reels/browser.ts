import gsap from 'gsap';
import {frameMarkup} from './visual.js';
import {reelDuration, type Reel} from './model.js';

const reel = JSON.parse(document.getElementById('reel-data')!.textContent!) as Reel;
const layer = document.getElementById('graphics')!;
// A property setter is evaluated by GSAP even when HyperFrames suppresses callbacks.
// No requestAnimationFrame, wall-clock timers or onUpdate callbacks in a render.
const clock = {get time() {return 0;}, set time(t: number) {layer.innerHTML = frameMarkup(reel, t);}};
clock.time = 0;
const timeline = gsap.timeline({paused: true}).to(clock, {time: reelDuration(reel), duration: reelDuration(reel), ease: 'none'}, 0);
(window as unknown as {__timelines: Record<string, unknown>}).__timelines = {[reel.id]: timeline};

// The workspace preview owns playback only when explicitly embedded in preview mode.
if (new URLSearchParams(location.search).has('preview')) {
  const video = document.querySelector('video')!;
  video.controls = false;
  video.muted = false;
  // A paused first frame acts as a readable poster; playback still starts at zero.
  const syncPreview = () => timeline.totalTime(video.paused && video.currentTime < .05 ? Math.min(.75, reelDuration(reel)) : video.currentTime, true);
  video.addEventListener('timeupdate', syncPreview);
  video.addEventListener('seeking', syncPreview);
  video.addEventListener('play', () => {timeline.totalTime(video.currentTime,true); timeline.play();});
  video.addEventListener('pause', () => timeline.pause());
  video.addEventListener('ended', () => timeline.pause());
  const sendState=()=>parent.postMessage({type:'delta-preview-state',time:video.currentTime,paused:video.paused},location.origin);
  ['timeupdate','play','pause','seeked'].forEach(name=>video.addEventListener(name,sendState));
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='delta-preview')return;
    if(event.data.action==='toggle') {
      if(video.paused)void video.play().catch(()=>parent.postMessage({type:'delta-preview-error',message:'Nie udało się odtworzyć nagrania. Odśwież podgląd i spróbuj ponownie.'},location.origin));
      else video.pause();
    }
    if(event.data.action==='seek'&&Number.isFinite(event.data.time))video.currentTime=Math.max(0,Math.min(reelDuration(reel)-1/30,event.data.time));
  });
  const fit = () => {document.getElementById('stage')!.style.transform = `scale(${Math.min(innerWidth/1080,innerHeight/1920)})`;};
  fit(); window.addEventListener('resize',fit);
  syncPreview();
}
