import {createRoot, type Root} from 'react-dom/client';
import {flushSync} from 'react-dom';
import LiquidGlass from 'liquid-glass-react';
import {brandCardAt, type MacWindow, type Reel} from './model.js';
import {easeMotion} from './text-motion.js';

const rows = (content: string) => content.split(/\r?\n/).filter(Boolean).slice(0, 12);

function WindowContent({window}: {window: MacWindow}) {
  const lines = rows(window.content);
  if (window.kind === 'glass') {
    const edge = window.edgeOpacity * (1 - window.edgeFeather);
    return <div className="d240-glass-sheet" style={{width: window.width, height: window.height,
      borderRadius: window.radius, backdropFilter: `blur(${Math.round(20 + window.blur * 55)}px) saturate(145%)`,
      borderColor: `rgba(255,255,255,${edge.toFixed(3)})`,
      boxShadow: `inset 0 0 ${Math.round(2 + window.edgeFeather * 32)}px rgba(255,255,255,${(window.edgeOpacity * window.edgeFeather * .38).toFixed(3)}), 0 22px ${Math.round(38 + window.shadowIntensity * 72)}px rgba(7,17,35,${(window.shadowIntensity * .42).toFixed(3)})`}}/>;
  }
  return <div className={`d240-mac-panel d240-mac-${window.kind}`} style={{width: window.width, height: window.height, borderRadius: window.radius}}>
    <div className="d240-mac-titlebar">
      <div className="d240-mac-lights" aria-hidden="true"><i/><i/><i/></div>
      <strong>{window.title || (window.kind === 'finder' ? 'Finder' : window.kind === 'editor' ? 'notes.md' : 'Terminal')}</strong>
      <span className="d240-mac-title-spacer"/>
    </div>
    {window.kind === 'finder' ? <div className="d240-mac-finder-body" style={{fontSize: window.contentSize}}>
      <aside><b>Ulubione</b><span>⌂ &nbsp; Biurko</span><span>◈ &nbsp; Projekty</span><span>▣ &nbsp; Dokumenty</span></aside>
      <main>{lines.map((line, index) => <div className="d240-mac-line" data-line={index} key={index}><span className="d240-mac-folder">▥</span><span>{line}</span></div>)}</main>
    </div> : window.kind === 'browser' ? <div className="d240-mac-browser-body" style={{fontSize: window.contentSize}}>
      <div className="d240-mac-address">◁ &nbsp; ▷ &nbsp; ↻ <span>{window.title || 'Strona'}</span> ⋯</div>
      <div className="d240-mac-browser-content">{lines.map((line, index) => <div className="d240-mac-line" data-line={index} key={index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{line}</strong></div>)}</div>
    </div> : <div className="d240-mac-text-body" style={{fontSize: window.contentSize}}>
      {lines.map((line, index) => <div className="d240-mac-line" data-line={index} key={index}>{window.kind === 'terminal' ? <span className="d240-mac-prompt">❯ </span> : <span className="d240-mac-line-number">{String(index + 1).padStart(2, '0')} </span>}{line}</div>)}
    </div>}
  </div>;
}

function MacWindowActor({window, sceneStart}: {window: MacWindow; sceneStart: number}) {
  return <div className="d240-mac-actor" data-window-id={window.id} data-window-kind={window.kind} data-start={sceneStart + window.startMs / 1000}
    data-end={sceneStart + window.endMs / 1000} data-enter-ms={window.enterMs} data-exit-ms={window.exitMs}
    data-enter={window.enter} data-exit={window.exit} data-easing={window.easing}
    data-travel={window.travelPx} data-scale-from={window.scaleFrom} data-line-delay={window.lineDelayMs}
    style={{left: window.x, top: window.y, width: window.width, height: window.height, display: 'none',
      borderRadius: window.radius,
      backdropFilter: window.kind === 'glass' ? `blur(${Math.round(20 + window.blur * 55)}px) saturate(140%)` : undefined}}>
    <LiquidGlass mode="standard" displacementScale={window.displacement} blurAmount={window.blur}
      saturation={window.saturation} aberrationIntensity={window.aberration} cornerRadius={window.radius}
      elasticity={0} globalMousePos={{x: 0, y: 0}} mouseOffset={{x: 0, y: 0}}
      padding="0" style={{position: 'absolute', left: '50%', top: '50%'}}>
      <WindowContent window={window}/>
    </LiquidGlass>
    <div className="d240-mac-grip d240-mac-grip-move" data-window-action="move" aria-label="Przesuń okno">⋮⋮</div>
    <div className="d240-mac-grip d240-mac-grip-resize" data-window-action="resize" aria-label="Zmień rozmiar okna">◢</div>
  </div>;
}

function WindowStack({reel, sceneIndex}: {reel: Reel; sceneIndex: number}) {
  const scene = reel.scenes[sceneIndex];
  const windows = [...(scene.motion?.windows ?? [])].sort((a, b) => Number(a.kind !== 'glass') - Number(b.kind !== 'glass'));
  return <>{windows.map(window =>
    <MacWindowActor key={window.id} window={window} sceneStart={scene.start}/>)}</>;
}

export function createMacWindowLayer(element: HTMLElement, initialReel: Reel) {
  const root: Root = createRoot(element);
  let reel = initialReel;
  let sceneIndex = -1;
  const draw = (index: number) => {
    sceneIndex = index;
    flushSync(() => root.render(<WindowStack reel={reel} sceneIndex={index}/>));
  };
  return {
    update(next: Reel) { reel = next; sceneIndex = -1; },
    seek(atTime: number) {
      const time = Math.min(atTime, reel.scenes.at(-1)!.end - 1 / 30);
      const index = Math.max(0, reel.scenes.findIndex(scene => time >= scene.start && time < scene.end));
      if (index !== sceneIndex) draw(index);
      for (const actor of Array.from(element.querySelectorAll<HTMLElement>('.d240-mac-actor'))) {
        const start = Number(actor.dataset.start);
        const end = Number(actor.dataset.end);
        const active = !brandCardAt(reel, time * 1000) && time >= start && time < end;
        actor.style.display = active ? 'block' : 'none';
        if (!active) continue;
        const easing = actor.dataset.easing as MacWindow['easing'];
        const entering = actor.dataset.enter === 'cut' || Number(actor.dataset.enterMs) === 0 ? 1
          : easeMotion((time - start) * 1000 / Number(actor.dataset.enterMs), easing);
        const leaving = actor.dataset.exit === 'cut' || Number(actor.dataset.exitMs) === 0 ? 1
          : easeMotion((end - time) * 1000 / Number(actor.dataset.exitMs), easing);
        actor.style.opacity = String(Math.max(0, Math.min(1, entering, leaving)));
        const travel = Number(actor.dataset.travel ?? 90);
        const inOffset = 1 - entering;
        const outOffset = 1 - leaving;
        const enterX = actor.dataset.enter === 'slide-right' ? inOffset * travel : 0;
        const enterY = actor.dataset.enter === 'fade-down' ? -inOffset * travel : 0;
        const exitY = actor.dataset.exit === 'slide-up' ? -outOffset * travel : 0;
        const enterScale = actor.dataset.enter === 'pop' ? Number(actor.dataset.scaleFrom ?? 0.9) + (1 - Number(actor.dataset.scaleFrom ?? 0.9)) * entering : 1;
        const exitScale = actor.dataset.exit === 'shrink' ? 1 - outOffset * 0.12 : 1;
        actor.style.transform = `translate(${enterX.toFixed(2)}px,${(enterY + exitY).toFixed(2)}px) scale(${(enterScale * exitScale).toFixed(4)})`;
        const lines = actor.querySelectorAll<HTMLElement>('.d240-mac-line');
        lines.forEach((line, index) => {
          line.style.opacity = time >= start + (Number(actor.dataset.enterMs) + 180 + index * Number(actor.dataset.lineDelay ?? 260)) / 1000 ? '1' : '0';
        });
      }
    },
  };
}
