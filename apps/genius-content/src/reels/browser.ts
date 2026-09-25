import gsap from 'gsap';
import {frameMarkup} from './visual.js';
import {reelDuration, reelSchema, type Reel} from './model.js';
import {createMacWindowLayer} from './mac-windows.js';

let reel = JSON.parse(document.getElementById('reel-data')!.textContent!) as Reel;
const layer = document.getElementById('graphics')!;
const captions = document.getElementById('captions')!;
const mac = createMacWindowLayer(document.getElementById('mac-windows')!, reel);
const glyphCanvas = document.createElement('canvas').getContext('2d')!;
function alignStackWords(text: HTMLElement) {
  if (!text.closest('.d240-safe-transcript')) return;
  const spans = Array.from(text.querySelectorAll<HTMLElement>('.motion-stack span'));
  for (let i = 1; i < spans.length; i++) {
    const style = getComputedStyle(spans[i]);
    glyphCanvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const previous = glyphCanvas.measureText(spans[i - 1].textContent ?? '');
    const current = glyphCanvas.measureText(spans[i].textContent ?? '');
    const gap = spans[i].offsetTop - spans[i - 1].offsetTop
      - previous.actualBoundingBoxDescent - current.actualBoundingBoxAscent;
    spans[i].style.marginTop = `${(20.5 - gap).toFixed(2)}px`;
  }
}
// A property setter is evaluated by GSAP even when HyperFrames suppresses callbacks.
// A render never depends on wall-clock timers or callback order.
const clock = {get time() {return 0;}, set time(t: number) {
  layer.innerHTML = frameMarkup(reel, t);
  captions.replaceChildren();
  const text = layer.querySelector<HTMLElement>('.safe-captions, .d240-captions');
  if (text) {
    const safe = text.parentElement?.classList.contains('d240-safe') ? text.parentElement : null;
    if (safe) {
      const shell = document.createElement('div');
      shell.className = safe.className.replace('d240-safe-brand-card', '');
      shell.setAttribute('style', safe.getAttribute('style') ?? '');
      shell.appendChild(text);
      captions.appendChild(shell);
    } else captions.appendChild(text);
    alignStackWords(text);
  }
  mac.seek(t);
}};
clock.time = 0;
const timeline = gsap.timeline({paused: true}).to(clock, {time: reelDuration(reel), duration: reelDuration(reel), ease: 'none'}, 0);
void document.fonts.ready.then(() => {clock.time = timeline.totalTime();});
(window as unknown as {__timelines: Record<string, unknown>}).__timelines = {[reel.id]: timeline};

// The workspace preview owns playback only when explicitly embedded in preview mode.
if (new URLSearchParams(location.search).has('preview')) {
  document.body.classList.add('d240-preview-edit');
  const video = document.querySelector('video')!;
  video.controls = false;
  video.muted = false;
  const syncPreview = () => timeline.totalTime(video.currentTime, true);
  let frameRequest = 0;
  const tick = () => {
    syncPreview();
    if (!video.paused) frameRequest = requestAnimationFrame(tick);
  };
  video.addEventListener('timeupdate', syncPreview);
  video.addEventListener('seeking', syncPreview);
  video.addEventListener('play', () => {cancelAnimationFrame(frameRequest); tick();});
  video.addEventListener('pause', () => {cancelAnimationFrame(frameRequest); syncPreview();});
  video.addEventListener('ended', () => {cancelAnimationFrame(frameRequest); syncPreview();});
  const sendState=()=>parent.postMessage({type:'delta-preview-state',time:video.currentTime,paused:video.paused},location.origin);
  ['timeupdate','play','pause','seeked'].forEach(name=>video.addEventListener(name,sendState));
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='delta-preview')return;
    if(event.data.action==='toggle') {
      if(video.paused)void video.play().catch(()=>parent.postMessage({type:'delta-preview-error',message:'Nie udało się odtworzyć nagrania. Odśwież podgląd i spróbuj ponownie.'},location.origin));
      else video.pause();
    }
    if(event.data.action==='seek'&&Number.isFinite(event.data.time))video.currentTime=Math.max(0,Math.min(reelDuration(reel)-1/30,event.data.time));
    if(event.data.action==='update' && event.data.draft && typeof event.data.draft === 'object') {
      const updated = reelSchema.safeParse({...reel, ...event.data.draft});
      if (!updated.success) return;
      reel = updated.data;
      mac.update(reel);
      // GSAP skips the clock setter when totalTime is unchanged (paused preview).
      // Redraw the current frame directly so every inspector input is visible live.
      clock.time = video.currentTime;
    }
  });
  document.getElementById('mac-windows')!.addEventListener('pointerdown', event => {
    const grip = (event.target as HTMLElement).closest<HTMLElement>('[data-window-action]');
    const actor = grip?.closest<HTMLElement>('.d240-mac-actor');
    if (!grip || !actor || !actor.dataset.windowId || actor.style.display === 'none') return;
    event.preventDefault();
    video.pause();
    const action = grip.dataset.windowAction;
    const scale = document.getElementById('stage')!.getBoundingClientRect().width / 1080;
    const origin = {x: actor.offsetLeft, y: actor.offsetTop, width: actor.offsetWidth, height: actor.offsetHeight};
    const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - event.clientX) / scale;
      const dy = (pointer.clientY - event.clientY) / scale;
      if (action === 'move') {
        actor.style.left = `${clamp(origin.x + dx, 0, 1080 - origin.width)}px`;
        actor.style.top = `${clamp(origin.y + dy, 0, 1920 - origin.height)}px`;
      } else {
        actor.style.width = `${clamp(origin.width + dx, 180, 1080 - origin.x)}px`;
        actor.style.height = `${clamp(origin.height + dy, 120, Math.min(1400, 1920 - origin.y))}px`;
        actor.style.outline = '3px solid #5ffff1';
      }
    };
    const finish = (pointer: PointerEvent) => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', finish);
      grip.removeEventListener('pointercancel', cancel);
      move(pointer);
      actor.style.outline = '';
      parent.postMessage({type: 'delta-preview-window-edit', id: actor.dataset.windowId,
        x: actor.offsetLeft, y: actor.offsetTop, width: actor.offsetWidth, height: actor.offsetHeight}, location.origin);
    };
    const cancel = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', finish);
      grip.removeEventListener('pointercancel', cancel);
      Object.assign(actor.style, {left: `${origin.x}px`, top: `${origin.y}px`, width: `${origin.width}px`, height: `${origin.height}px`, outline: ''});
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', cancel);
    grip.setPointerCapture(event.pointerId);
  });
  const fit = () => {document.getElementById('stage')!.style.transform = `scale(${Math.min(innerWidth/1080,innerHeight/1920)})`;};
  fit(); window.addEventListener('resize',fit);
  syncPreview();
}
