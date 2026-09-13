import {BRAND as B, captionPages, reelDuration, type Reel, type ReelScene} from './model';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);
export const FONT_CSS = `@font-face{font-family:Inter;src:url('fonts/inter-latin-v1.woff2');font-weight:100 900;font-display:block}@font-face{font-family:'IBM Plex Mono';src:url('fonts/ibm-plex-mono-400-latin-v1.woff2');font-weight:400;font-display:block}@font-face{font-family:'IBM Plex Mono';src:url('fonts/ibm-plex-mono-500-latin-v1.woff2');font-weight:500;font-display:block}`;

export const VISUAL_CSS = `
.d240-stage,.d240-stage *{box-sizing:border-box}.d240-stage{width:1080px;height:1920px;position:relative;overflow:hidden;background:${B.ivory};color:${B.ink};font-family:${B.sans};font-synthesis:none}
.d240-video{position:absolute!important;left:64px!important;top:762px!important;width:952px!important;height:914px!important;object-fit:cover!important;object-position:50% 28%!important}
.d240-overlay{position:absolute;inset:0;pointer-events:none}.d240-top{position:absolute;left:0;top:0;width:1080px;height:762px;background:${B.ivory};padding:0 64px}
.d240-header{position:absolute;top:84px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid ${B.ink};padding-bottom:26px}
.d240-brand{font-size:34px;font-weight:900;letter-spacing:-1.9px;white-space:nowrap}.d240-mono{font-family:${B.mono};font-weight:500;font-size:20px;letter-spacing:1.1px;text-transform:uppercase}.d240-header .d240-mono{font-size:18px}
.d240-kicker{position:absolute;top:184px;left:64px;display:flex;align-items:center;gap:14px;color:${B.violetText}}.d240-square{display:block;width:14px;height:14px;background:var(--accent)}
.d240-headline{position:absolute;left:60px;right:64px;top:237px;margin:0;font-weight:900;font-size:108px;line-height:.99;letter-spacing:-6px;white-space:pre-line}.d240-headline.long{font-size:68px;letter-spacing:-3px;line-height:1.04;overflow-wrap:anywhere}
.d240-graphic{position:absolute;left:64px;right:64px;top:480px;height:166px}.d240-detail{position:absolute;left:64px;right:64px;top:673px;font-size:25px;line-height:1.35;color:${B.muted}}
.d240-grid{height:100%;display:flex;gap:14px}.d240-card{flex:1;min-width:0;border:1px solid ${B.ink};padding:22px 24px;background:${B.paper};position:relative;overflow:hidden}.d240-card b{display:block;font-size:31px;letter-spacing:-1px;line-height:1.2}.d240-card small{display:block;font-family:${B.mono};font-size:18px;margin-top:17px}.d240-card .d240-n{position:absolute;right:16px;top:12px;font-size:17px;font-family:${B.mono}}
.d240-code{height:100%;background:${B.ink};color:${B.ivory};padding:23px 28px;font:25px/1.6 ${B.mono};border-left:10px solid var(--accent)}.d240-code span{color:var(--accent)}
.d240-type{height:100%;border-top:2px solid ${B.ink};border-bottom:2px solid ${B.ink};display:flex;align-items:center;gap:24px;font-size:48px;font-weight:800;letter-spacing:-2px}.d240-type strong{color:${B.violetText}}.d240-cursor{width:3px;height:54px;background:var(--accent)}
.d240-search{height:100%;border:1px solid ${B.ink};background:${B.paper};padding:22px 28px}.d240-search strong{font-size:29px}.d240-search .d240-line{height:7px;background:${B.line};margin-top:16px;transform-origin:left}.d240-search .d240-line.accent{background:var(--accent)}
.d240-wave{height:100%;display:flex;align-items:center;gap:8px;background:${B.ink};padding:25px 28px}.d240-wave i{display:block;flex:1;background:var(--accent)}
.d240-step{border-top:3px solid ${B.ink};padding:22px 14px;flex:1;min-width:0;background:${B.paper};font-family:${B.mono};font-size:21px}.d240-step b{font-family:${B.sans};display:block;font-size:28px;letter-spacing:-1px;margin-top:18px}.d240-step.active{background:var(--accent)}
.d240-render{height:100%;background:${B.ink};color:${B.ivory};padding:23px 28px}.d240-render-row{display:flex;justify-content:space-between;font-size:31px;font-weight:800}.d240-render-track{height:13px;background:#ffffff30;margin:23px 0 14px}.d240-render-track i{display:block;height:100%;background:var(--accent);transform-origin:left}.d240-render small{font:18px ${B.mono}}
.d240-outro{height:100%;background:var(--accent);padding:22px 28px;display:flex;align-items:center;justify-content:space-between}.d240-outro b{font-size:38px;letter-spacing:-1.5px}.d240-outro span{font-size:56px}
.d240-video-edge{position:absolute;top:762px;left:64px;width:952px;height:914px;border:2px solid ${B.ink}}.d240-person{position:absolute;left:88px;top:790px;background:${B.ivory};color:${B.ink};padding:10px 14px;font:500 17px ${B.mono};letter-spacing:.5px}
.d240-captions{position:absolute;left:64px;right:64px;top:1496px;min-height:180px;display:flex;align-items:center;background:${B.ink};padding:23px 30px;color:${B.ivory};font-size:46px;font-weight:800;line-height:1.2;letter-spacing:-1.2px}.d240-captions span{display:inline-block;margin-right:10px}.d240-captions .active{color:var(--accent)}
.d240-footer{position:absolute;left:64px;right:64px;top:1710px;display:flex;justify-content:space-between;align-items:center}.d240-footer strong{font-size:25px;font-weight:800;letter-spacing:-.7px}.d240-footer span{font:18px ${B.mono};color:${B.muted}}
.d240-progress{position:absolute;left:64px;right:64px;top:1771px;height:4px;background:${B.line}}.d240-progress i{display:block;height:100%;background:${B.ink};transform-origin:left}
.d240-signal .d240-top{background:${B.ink};color:${B.ivory}}.d240-signal .d240-header{border-color:#ffffff50}.d240-signal .d240-kicker{color:var(--accent)}.d240-signal .d240-detail{color:#c8c7c3}.d240-signal .d240-card,.d240-signal .d240-step,.d240-signal .d240-search,.d240-signal .d240-outro{color:${B.ink}}.d240-signal .d240-type{border-color:#ffffff60}.d240-signal .d240-type strong{color:var(--accent)}
`;

function graphic(scene: ReelScene, t: number): string {
  const reveal = ease(t / .7);
  const labels = scene.labels.map(escapeHtml);
  const card = (label: string, detail: string, i: number) => `<div class="d240-card" style="transform:translateY(${(1-ease((t-i*.1)/.6))*28}px);opacity:${ease((t-i*.1)/.5)};${i===0?'background:var(--accent)':''}"><span class="d240-n">0${i+1}</span><b>${label}</b><small>${detail}</small></div>`;
  switch (scene.graphic) {
    case 'models': return `<div class="d240-grid">${['ChatGPT','Claude','Gemini'].map((s,i)=>card(s,['kod','forma','research'][i],i)).join('')}</div>`;
    case 'code': return `<div class="d240-code"><span>01</span> pomysł → kod<br><span>02</span> test → poprawka → gotowe<span style="opacity:${.5+.5*Math.sin(t*4)}"> ▌</span></div>`;
    case 'writing': return `<div class="d240-type"><strong>Aa</strong><span>${escapeHtml('Forma ma znaczenie.'.slice(0,Math.max(1,Math.floor(t*24))))}</span><i class="d240-cursor"></i></div>`;
    case 'research': return `<div class="d240-search"><strong>temat → źródła → wnioski</strong><div class="d240-line accent" style="width:86%;transform:scaleX(${reveal})"></div><div class="d240-line" style="width:68%;transform:scaleX(${ease((t-.1)/.8)})"></div><div class="d240-line" style="width:92%;transform:scaleX(${ease((t-.2)/.8)})"></div></div>`;
    case 'wave': return `<div class="d240-wave">${Array.from({length:44},(_,i)=>`<i style="height:${12+(30+Math.sin(i*2.3+t*5)*24+Math.cos(i*.7-t*3)*18)*reveal}px;opacity:${i%4===0?'.5':'1'}"></i>`).join('')}</div>`;
    case 'assets': return `<div class="d240-grid">${['Materiały','Kontekst','Animacje'].map((s,i)=>card(labels[i]??s,['obraz','znaczenie','ruch'][i],i)).join('')}</div>`;
    case 'render': return `<div class="d240-render"><div class="d240-render-row"><span>Wszystko w jednym filmie.</span><span>↗</span></div><div class="d240-render-track"><i style="transform:scaleX(${.1+.9*ease(t/2.5)})"></i></div><small>GŁOS + NAPISY + MATERIAŁY + RUCH</small></div>`;
    case 'outro': return `<div class="d240-outro"><b>${labels[0]??'Zrób pierwszy krok z AI.'}<br><span style="font:500 21px ${B.mono}">GENIUS@WORK</span></b><span style="transform:translateX(${Math.sin(t*2)*5}px)">↗</span></div>`;
    default: return `<div class="d240-grid">${(labels.length?labels:['Transkrypcja','Materiały','Montaż']).map((s,i)=>`<div class="d240-step ${Math.floor(t/1.2)%3===i?'active':''}" style="opacity:${ease((t-i*.12)/.5)}">0${i+1}<b>${s}</b></div>`).join('')}</div>`;
  }
}

/** Pure frame function used by the GSAP/Hyperframes timeline and preview. */
export function frameMarkup(reel: Reel, time: number): string {
  time=Math.max(0,Math.min(time,reelDuration(reel)-1/30));
  const index = Math.max(0, reel.scenes.findIndex(s => time >= s.start && time < s.end));
  const scene = reel.scenes[index];
  const local = Math.max(0, time-scene.start);
  const accent = B[scene.accent];
  const entry = ease((local + .06)/.55);
  const page = captionPages(reel.words).find((p,i,all) => time*1000 >= p[0].startMs && time*1000 < Math.min(p.at(-1)!.endMs+180,all[i+1]?.[0].startMs??Infinity));
  const title = escapeHtml(scene.title);
  return `<div class="d240-overlay ${reel.style==='signal'?'d240-signal':''}" style="--accent:${accent}">
    <div class="d240-top"><div class="d240-header"><div class="d240-brand">GENIUS@WORK</div><span class="d240-mono">AI / W PRAKTYCE</span></div>
    <div class="d240-kicker d240-mono"><i class="d240-square"></i>${escapeHtml(scene.kicker)}</div>
    <h1 class="d240-headline ${scene.title.length>34?'long':''}" style="opacity:${entry};transform:translateY(${(1-entry)*24}px)">${title}</h1>
    <div class="d240-graphic">${graphic(scene,local)}</div><div class="d240-detail">${escapeHtml(scene.detail)}</div></div>
    <div class="d240-video-edge"></div><div class="d240-person">GENIUS@WORK</div>
    ${page?`<div class="d240-captions"><div>${page.map(w=>`<span class="${time*1000>=w.startMs&&time*1000<w.endMs?'active':''}">${escapeHtml(w.word)}</span>`).join('')}</div></div>`:''}
    <div class="d240-footer"><strong>Twórz. Rozwijaj. Automatyzuj.</strong><span>${String(index+1).padStart(2,'0')} / ${String(reel.scenes.length).padStart(2,'0')}</span></div>
    <div class="d240-progress"><i style="transform:scaleX(${clamp(time/reelDuration(reel))})"></i></div></div>`;
}
