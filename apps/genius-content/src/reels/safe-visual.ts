import {BRAND, brandCardAt, captionPages, reelDuration, type Reel, type ReelScene} from './model';
import {captionMotionMarkup, textEntryStyle} from './text-motion';

export const SAFE_CSS = `
.d240-stage.d240-full .d240-video{left:0!important;top:0!important;width:1080px!important;height:1920px!important;object-position:center!important}
.d240-safe{position:absolute;left:120px;top:300px;width:760px;height:1300px;overflow:hidden;contain:paint;color:#F8F7F3;pointer-events:none}
.safe-title{position:absolute;left:24px;top:30px;width:712px;margin:0;font-weight:900;line-height:1.04;letter-spacing:-.045em;text-shadow:0 2px 4px #020304,0 4px 18px #020304;white-space:pre-line}
.safe-art{position:absolute;left:24px;top:824px;width:712px;height:270px;filter:drop-shadow(0 8px 9px #02030480)}
.safe-captions{position:absolute;left:24px;bottom:40px;width:712px;height:112px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:42px;font-weight:800;line-height:1.2;letter-spacing:-.025em;text-shadow:0 2px 3px #020304,0 3px 10px #020304}
.safe-captions span{display:inline-block}.safe-captions .active{color:var(--accent)}
.safe-captions .motion-words{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:11px;row-gap:14px}.safe-captions .motion-words span{white-space:nowrap}
.safe-captions .motion-stack{flex-direction:column;flex-wrap:nowrap;gap:9px;width:100%}
.d240-safe-window-mode .safe-title,.d240-safe-window-mode .safe-art{visibility:hidden}
.d240-safe-cutaway .safe-captions{color:#12213a;text-shadow:none}
.d240-safe-cutaway .safe-captions .active{color:#12213a}
.d240-safe-transcript{left:0;top:0;width:1080px;height:1920px;overflow:visible;contain:none}
.d240-safe-transcript .safe-captions{left:96px;width:888px;height:170px;bottom:auto;padding:0;color:#F8F7F3;font-weight:700;line-height:.805;letter-spacing:-.085em;text-shadow:0 12px 34px #02030491,0 24px 64px #02030457}
.d240-safe-transcript .safe-captions .active{color:inherit}
.d240-safe-transcript .motion-words{width:100%;gap:0}
.d240-safe-transcript .motion-stack{align-self:flex-start;gap:20px}
.d240-safe-transcript .motion-words span{margin:0;line-height:.805}
.d240-safe-transcript.d240-safe-cutaway .safe-captions{color:#020304;text-shadow:none}
.d240-safe-brand-card{background:#00D6D8}
.d240-safe-brand-card .safe-captions{top:875px!important;line-height:.805;color:#020304;text-shadow:none}
`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const ease = (n: number) => 1 - (1 - Math.max(0, Math.min(1,n))) ** 3;

// Two balanced lines; conservative font sizing also handles long unbroken input.
function titleLayout(title: string) {
  const words=title.trim().split(/\s+/);
  let lines=[title.trim()];
  if(words.length>1) {
    let split=1;
    for(let i=1;i<words.length;i++) if(Math.abs(words.slice(0,i).join(' ').length-words.slice(i).join(' ').length)<Math.abs(words.slice(0,split).join(' ').length-words.slice(split).join(' ').length))split=i;
    lines=[words.slice(0,split).join(' '),words.slice(split).join(' ')];
  }
  const max=Math.max(...lines.map(line=>line.length));
  return {text:lines.map(esc).join('\n'),size:Math.min(76,Math.floor(690/(max*1.05)))};
}
const line=(x:number,y:number,w:number,color='currentColor',h=8)=>`<path d="M${x} ${y}h${w}" stroke="${color}" stroke-width="${h}" stroke-linecap="square"/>`;
const cursor=(x:number,y:number)=>`<path d="M${x} ${y}l0 43 12-12 12 22 10-6-12-21 17-2Z" fill="var(--accent)" stroke="#020304" stroke-width="3"/>`;
const paper=(x:number,y:number,w:number,h:number)=>`<path d="M${x} ${y}h${w-25}l25 25v${h-25}H${x}Z" fill="#F8F7F3" stroke="#020304" stroke-width="3"/><path d="M${x+w-25} ${y}v25h25" fill="none" stroke="#020304" stroke-width="3"/>`;

function interfaceArt(kind:ReelScene['graphic'], p:number):string {
  const reveal=ease(p*2);
  const ink='#020304';
  switch(kind) {
    case 'code': return `<path d="M80 28h550v210H80Z" fill="${ink}" stroke="#F8F7F3" stroke-width="2"/>${[0,1,2].map(i=>`<circle cx="${102+i*15}" cy="46" r="4" fill="var(--accent)"/>`).join('')}${line(80,65,550,'#F8F7F3',2)}<path d="M155 102l-24 22 24 22m50-44 24 22-24 22m-22-57-14 73" fill="none" stroke="var(--accent)" stroke-width="5"/>${[0,1,2,3].map(i=>line(266,99+i*29,(i%2?230:285)*ease(p*3-i*.2),i%2?'var(--accent)':'#F8F7F3',7)).join('')}${cursor(530-35*reveal,175)}`;
    case 'writing': return `${paper(160,18,390,230)}<path d="M190 106h${300*reveal}v33H190Z" fill="var(--accent)" opacity=".65"/>${[0,1,2,3,4].map(i=>line(190,60+i*32,(i===4?175:300)*ease(p*3-i*.15),ink,i===0?13:6)).join('')}<path d="M${200+280*reveal} 95v50" stroke="${ink}" stroke-width="3"/>`;
    case 'research': return `<path d="M100 25h510v54H100Z" fill="#F8F7F3" stroke="${ink}" stroke-width="3"/><circle cx="130" cy="49" r="11" fill="none" stroke="${ink}" stroke-width="3"/><path d="m138 57 10 10" stroke="${ink}" stroke-width="3"/>${line(172,52,260*reveal,ink,7)}${[0,1,2].map(i=>`<g opacity="${ease(p*3-i*.35)}">${paper(125+i*165,100,145,140)}${line(141+i*165,137,95,'var(--accent)',8)}${line(141+i*165,162,100,ink,5)}${line(141+i*165,185,80,ink,5)}${line(141+i*165,207,90,ink,5)}</g>`).join('')}${cursor(510,75+70*reveal)}`;
    case 'models': return `<path d="M107 30h496v200H107Z" fill="${ink}" stroke="#F8F7F3" stroke-width="2"/>${[0,1,2].map(i=>`<circle cx="148" cy="${73+i*58}" r="13" fill="none" stroke="${i===Math.min(2,Math.floor(p*3))?'var(--accent)':'#F8F7F3'}" stroke-width="4"/>${line(185,73+i*58,310,i===Math.min(2,Math.floor(p*3))?'var(--accent)':'#F8F7F3',9)}`).join('')}${cursor(510,48+116*reveal)}`;
    default: return `<path d="M85 35h540v195H85Z" fill="${ink}" stroke="#F8F7F3" stroke-width="2"/>${[0,1,2].map(i=>`<path d="M110 ${67+i*50}h${[380,460,290][i]}v32H110Z" fill="${i===1?'var(--accent)':'#F8F7F3'}" opacity=".9"/>`).join('')}<path d="M${120+460*reveal} 45v175" stroke="var(--accent)" stroke-width="4"/>`;
  }
}
function metaphorArt(kind:ReelScene['graphic'],p:number):string {
  const q=ease(p*1.7);
  switch(kind) {
    case 'code': return `<g transform="translate(${(1-q)*45} 0)"><path d="M110 80l-55 50 55 50m90-100 55 50-55 50m-35-115-30 130" fill="none" stroke="var(--accent)" stroke-width="10"/>${line(280,130,65,'#F8F7F3',4)}<path d="m330 117 15 13-15 13" fill="none" stroke="#F8F7F3" stroke-width="4"/><g opacity="${q}"><path d="M385 35h240v175H385Z" fill="#F8F7F3" stroke="#020304" stroke-width="3"/><path d="M385 35h240v40H385Z" fill="var(--accent)"/><circle cx="438" cy="124" r="24" fill="#020304"/>${line(480,108,115,'#020304',8)}${line(480,132,90,'#020304',5)}<path d="M415 171h180" stroke="var(--accent)" stroke-width="17"/><path d="M470 212v23m-45 0h90" stroke="#F8F7F3" stroke-width="7"/></g></g>`;
    case 'writing': return `<g transform="translate(${(1-q)*-60} 0)">${paper(245,15,215,235)}${line(268,58,110,'#020304',15)}${[0,1,2,3].map(i=>line(269,100+i*27,(i===3?110:164)*q,'#020304',6)).join('')}<g transform="translate(${(1-q)*90} ${(1-q)*-25})"><path d="m475 26 30 16-83 159-35 26 3-44Z" fill="var(--accent)" stroke="#020304" stroke-width="4"/><path d="m390 183 32 18m-35 26 9-25" stroke="#020304" stroke-width="4"/></g></g>`;
    case 'research': return `${[0,1,2].map(i=>`<g transform="translate(${i*135*(1-q)} ${i*12*(1-q)})" opacity="${1-i*.16}">${paper(190+i*14,27+i*8,220,190)}${line(215+i*14,67+i*8,145,'#020304',8)}${line(215+i*14,100+i*8,160,'#020304',5)}${line(215+i*14,130+i*8,120,'#020304',5)}</g>`).join('')}<g transform="translate(${50*(1-q)} 0)"><circle cx="439" cy="114" r="65" fill="#020304" stroke="var(--accent)" stroke-width="13"/><path d="m484 161 71 70" stroke="var(--accent)" stroke-width="23"/><path d="m407 115 22 22 42-48" fill="none" stroke="#F8F7F3" stroke-width="8"/></g>`;
    case 'models': return `<path d="M135 130H300M300 130Q335 130 355 60H515M300 130H515M300 130Q335 130 355 200H515" fill="none" stroke="#F8F7F3" stroke-width="4"/><path d="m80 130 35-45 35 45-35 45Z" fill="var(--accent)"/>${[60,130,200].map((y,i)=>`<g transform="translate(${515-100*(1-q)} ${y})" opacity="${ease(p*3-i*.2)}"><circle r="29" fill="#020304" stroke="var(--accent)" stroke-width="4"/>${i===0?'<path d="m-7-10-10 10 10 10m14-20 10 10-10 10" stroke="#F8F7F3" fill="none" stroke-width="3"/>':i===1?'<path d="m-10 12 4-15 12-12 9 9-12 12Z" fill="#F8F7F3"/>':'<circle r="10" fill="none" stroke="#F8F7F3" stroke-width="3"/><path d="m8 8 9 9" stroke="#F8F7F3" stroke-width="3"/>'}</g>`).join('')}`;
    case 'wave': return Array.from({length:38},(_,i)=>`<path d="M${100+i*14} ${130-(18+Math.abs(Math.sin(i*.6+p*5))*75)*q}v${(36+Math.abs(Math.sin(i*.6+p*5))*150)*q}" stroke="var(--accent)" stroke-width="7"/>`).join('');
    default: return `${[0,1,2].map(i=>`<g transform="translate(${(i-1)*170*(1-q)} ${(i-1)*25*(1-q)})" opacity="${1-i*.15}">${paper(250,20,210,230)}<path d="m298 185 40-55 30 25 35-65 30 95Z" fill="var(--accent)"/><circle cx="300" cy="76" r="19" fill="#020304"/></g>`).join('')}`;
  }
}

export function safeFrameMarkup(reel:Reel,time:number):string {
  const t=Math.max(0,Math.min(time,reelDuration(reel)-1/30));
  const scene=reel.scenes.find(s=>t>=s.start&&t<s.end)??reel.scenes[0];
  const brandCard=brandCardAt(reel,t*1000);
  const local=t-scene.start, duration=scene.end-scene.start;
  const windowMode=scene.overlayOnly || scene.cutaway || scene.motion?.windows.some(window=>window.kind!=='glass'&&local*1000>=window.startMs&&local*1000<window.endMs);
  const p=Math.max(0,Math.min(1,local/duration));
  const entry=ease(local/.35), exit=ease((duration-local)/.25);
  const morph=ease((p-.3)/.35);
  const title=titleLayout(scene.title);
  const pages=captionPages(reel.words);
  const captionLag=scene.motion?.caption.lagMs??0;
  const captionHold=scene.motion?.caption.holdMs??0;
  const page=pages.find((words,i)=>t*1000>=words[0].startMs+captionLag&&t*1000<Math.min(words.at(-1)!.endMs+captionLag+Math.max(scene.motion?.caption.preset === 'stack' ? 270 : 180,captionHold),(pages[i+1]?.[0].startMs??Infinity)+captionLag));
  const cardWord=brandCard && reel.words.filter(word => word.startMs >= brandCard.startMs && word.startMs < brandCard.endMs && word.startMs <= t*1000).at(-1);
  const concept=reel.motionConcept!;
  const art=concept==='interface'?interfaceArt(scene.graphic,p):concept==='metaphor'?metaphorArt(scene.graphic,p):`<g opacity="${1-morph}" transform="translate(${-55*morph} 0) scale(${1-morph*.08})">${interfaceArt(scene.graphic,p)}</g><g opacity="${morph}" transform="translate(${20*(1-morph)} 0)">${metaphorArt(scene.graphic,p)}</g>`;
  const captionLines=page?[page]:[];
  if(page && page.map(w=>w.word).join(' ').length*42*1.05>680 && page.length>1) {
    const width=(words:typeof page)=>words.map(w=>w.word).join(' ').length;
    let split=1;
    for(let i=1;i<page.length;i++) if(Math.max(width(page.slice(0,i)),width(page.slice(i)))<Math.max(width(page.slice(0,split)),width(page.slice(split))))split=i;
    captionLines.splice(0,1,page.slice(0,split),page.slice(split));
  }
  const longest=Math.max(1,...captionLines.map(words=>words.map(w=>w.word).join(' ').length));
  const captionSize=Math.min(42,Math.floor(680/(longest*1.05)));
  const captionHtml=captionLines.map(words=>words.map(w=>`<span class="${t*1000>=w.startMs&&t*1000<w.endMs?'active':''}">${esc(w.word)}</span>`).join(' ')).join('<br>');
  const titleMotion=scene.motion?.title;
  const captionMotion=scene.motion?.caption;
  const stackFade=page && captionMotion?.preset === 'stack'
    ? Math.max(0,Math.min(1,(page.at(-1)!.endMs+captionLag+270-t*1000)/270)) : 1;
  const titleStyle=titleMotion
    ? `top:${titleMotion.y-300}px;font-size:${titleMotion.size}px;font-family:${titleMotion.font === 'delta240mvt' ? 'delta240mvt_font' : 'Inter'};letter-spacing:${titleMotion.tracking}px;text-shadow:0 5px ${titleMotion.shadowBlur}px #020304b0;${textEntryStyle(titleMotion,local*1000-titleMotion.lagMs)}`
    : `font-size:${title.size}px;opacity:${entry};transform:translateY(${12*(1-entry)}px)`;
  const captionStyle=captionMotion
    ? `top:${brandCard ? 875 : scene.overlayOnly ? captionMotion.y : captionMotion.y-300}px;bottom:auto;height:${captionMotion.preset === 'stack' ? 360 : 170}px;font-size:${captionMotion.size}px;font-family:${captionMotion.font === 'delta240mvt' ? 'delta240mvt_font' : 'Inter'};letter-spacing:${captionMotion.tracking}px;opacity:${stackFade.toFixed(4)};text-shadow:${scene.cutaway || brandCard ? 'none' : `0 12px ${captionMotion.shadowBlur}px #02030491,0 24px ${Math.min(80,captionMotion.shadowBlur*2)}px #02030457`}`
    : `font-size:${captionSize}px`;
  const animatedCaption=brandCard
    ? `<div class="motion-words">${cardWord ? `<span class="active">${esc(cardWord.word.toLowerCase())}</span>` : ''}</div>`
    : captionMotion&&page
    ? `<div class="motion-words${captionMotion.preset === 'stack' ? ' motion-stack' : ''}">${captionMotionMarkup(page,t*1000,captionMotion,word=>esc(word.toLowerCase()))}</div>`
    : `<div>${captionHtml}</div>`;
  return `<div class="d240-safe${scene.overlayOnly?' d240-safe-transcript':''}${windowMode?' d240-safe-window-mode':''}${scene.cutaway?' d240-safe-cutaway':''}${brandCard?' d240-safe-brand-card':''}" data-concept="${concept}" style="--accent:${BRAND[scene.accent]}"><h1 class="safe-title" style="${titleStyle}">${title.text}</h1><svg class="safe-art" viewBox="0 0 712 270" aria-hidden="true" style="opacity:${entry*exit}"><g transform="translate(0 ${12*(1-entry)})">${art}</g></svg>${page||brandCard?`<div class="safe-captions" style="${captionStyle}">${animatedCaption}</div>`:''}</div>`;
}

