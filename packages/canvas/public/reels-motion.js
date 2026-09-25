export const defaultMotion = (safe = false, sceneTitle = '') => ({
  title: {preset: 'fade-down', font: 'delta240mvt', easing: 'ease-out', durationMs: 420, offsetPx: 24,
    size: safe ? Math.min(76, Math.max(30, Math.floor(690 / (Math.max(1, Math.ceil(sceneTitle.length / 2)) * 1.05)))) : sceneTitle.length > 34 ? 68 : 108,
    tracking: safe ? -3 : sceneTitle.length > 34 ? -3 : -6, y: safe ? 330 : 237, shadowBlur: safe ? 18 : 0, lagMs: 0, holdMs: 0},
  caption: {preset: 'fade-down', font: 'delta240mvt', easing: 'ease-out', durationMs: 320, offsetPx: 20, size: safe ? 42 : 46, tracking: -1.2, y: 1496, shadowBlur: 18, lagMs: 0, holdMs: 0},
  windows: [],
});
const escapeAttribute = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

export function createWindow(scene, ordinal, currentTime, kind = 'finder') {
  const duration = Math.round((scene.end - scene.start) * 1000);
  const startMs = Math.min(Math.max(0, Math.round((currentTime - scene.start) * 1000)), Math.max(0, duration - 500));
  return {
    id: `mac-${Date.now().toString(36)}-${ordinal}`, kind, title: kind === 'glass' ? '' : kind === 'browser' ? 'Safari' : 'Finder',
    content: kind === 'glass' ? '' : 'Projekt\nDokumenty\nMateriały\nGotowy film', x: kind === 'glass' ? 75 : 145, y: kind === 'glass' ? 200 : 390,
    width: kind === 'glass' ? 930 : 790, height: kind === 'glass' ? 900 : 440,
    startMs, endMs: Math.min(duration, startMs + 4000), enterMs: 450, exitMs: 280,
    enter: 'fade-down', exit: 'fade', easing: 'ease-out', travelPx: 90, scaleFrom: 0.9, lineDelayMs: 260, contentSize: 18,
    radius: 28, blur: kind === 'glass' ? 0.48 : 0.24,
    shadowIntensity: 0.45, edgeOpacity: 0.5, edgeFeather: 0.55, displacement: 48,
    saturation: 140, aberration: 2,
  };
}

const slider = (group, key, label, value, min, max, step = 1, unit = '') => `
  <label class="motion-control"><span>${label}<output>${value}${unit}</output></span>
    <input type="range" data-motion-group="${group}" data-motion-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"></label>`;
const field = (key, label, value, escape, type = 'number', min = 0, max = 9999, step = 1) => `
  <label class="motion-field">${label}<input data-window-key="${key}" type="${type}" ${type === 'number' ? `min="${min}" max="${max}" step="${step}"` : ''} value="${escape(value)}"></label>`;
const options = (items, value) => items.map(([id, label]) => `<option value="${id}" ${id === value ? 'selected' : ''}>${label}</option>`).join('');
const textPresets = [['fade-down', 'Fade down'], ['fade-up', 'Fade up'], ['stack', 'Stos słów'], ['pop', 'Pop'], ['replace', 'Zastąp w miejscu'], ['cut', 'Cięcie']];
const easingOptions = [['ease-out', 'Ease out'], ['ease-in-out', 'Ease in/out'], ['linear', 'Linear'], ['spring', 'Spring']];

function textControls(group, motion) {
  return `<div class="motion-group" data-motion-section="${group}">
    <label class="motion-field">Animacja<select data-motion-group="${group}" data-motion-key="preset">${options(textPresets, motion.preset)}</select></label>
    <label class="motion-field">Czcionka<select data-motion-group="${group}" data-motion-key="font">${options([['delta240mvt', 'delta240mvt_font Bold'], ['inter', 'Inter']], motion.font || 'inter')}</select></label>
    <label class="motion-field">Krzywa ruchu<select data-motion-group="${group}" data-motion-key="easing">${options(easingOptions, motion.easing || 'ease-out')}</select></label>
    ${slider(group, 'durationMs', 'Czas wejścia', motion.durationMs, 0, 1800, 10, ' ms')}
    ${slider(group, 'offsetPx', 'Droga wejścia', motion.offsetPx, 0, 160, 1, ' px')}
    ${slider(group, 'size', 'Wielkość', motion.size, 24, 160, 1, ' px')}
    ${slider(group, 'tracking', 'Spacing', motion.tracking, -14, 12, 0.1, ' px')}
    ${slider(group, 'y', 'Pozycja Y', motion.y, group === 'caption' ? 800 : 0, group === 'caption' ? 1850 : 1000, 1, ' px')}
    ${slider(group, 'shadowBlur', 'Miękkość cienia', motion.shadowBlur, 0, 80, 1, ' px')}
    ${group === 'caption' ? `${slider(group, 'lagMs', 'Przesunięcie względem mowy', motion.lagMs ?? 0, -500, 500, 10, ' ms')}${slider(group, 'holdMs', 'Przytrzymanie słowa', motion.holdMs ?? 0, 0, 1000, 10, ' ms')}` : ''}
  </div>`;
}

export function motionInspector(scene, sceneIndex, windowIndex, safe, escape, dirty = false) {
  const motion = scene.motion || defaultMotion(safe, scene.title);
  const window = motion.windows[windowIndex] || null;
  return `<section class="motion-inspector" aria-label="Inspektor animacji">
    <div class="reel-panel-label">ANIMACJE <span>SCENA ${String(sceneIndex + 1).padStart(2, '0')}</span></div>
    <p class="motion-inspector-hint">Reguluj podczas odtwarzania. Podgląd reaguje od razu, bez eksportu.</p>
    <div class="motion-scene-options"><label><input type="checkbox" data-scene-option="overlayOnly" ${scene.overlayOnly ? 'checked' : ''}> Tylko wideo i napisy</label><label><input type="checkbox" data-scene-option="cutaway" ${scene.cutaway ? 'checked' : ''}> Napisy na Liquid Glass</label></div>
    <details class="motion-detail" open><summary>Tekst sceny</summary>${textControls('title', motion.title)}</details>
    <details class="motion-detail" open><summary>Napisy z transkrypcji</summary>${textControls('caption', motion.caption)}</details>
    <details class="motion-detail" open><summary>Okna Mac · Liquid Glass <span>${motion.windows.length}</span></summary>
      <div class="motion-window-list">${motion.windows.map((item, index) => `<button type="button" data-select-window="${index}" class="motion-window-tab ${index === windowIndex ? 'selected' : ''}">${escape(item.title || item.kind)} <small>${Math.round(item.startMs / 100) / 10}s</small></button>`).join('')}</div>
      <div class="motion-add-buttons"><button type="button" class="btn" data-add-window="finder" ${motion.windows.length >= 12 ? 'disabled' : ''}>＋ Finder</button><button type="button" class="btn" data-add-window="browser" ${motion.windows.length >= 12 ? 'disabled' : ''}>＋ Safari</button><button type="button" class="btn" data-add-window="glass" ${motion.windows.length >= 12 ? 'disabled' : ''}>＋ Szkło</button></div>
      ${window ? `<div class="motion-window-fields">
        <label class="motion-field">Typ warstwy<select data-window-key="kind">${options([['finder', 'Finder'], ['editor', 'Edytor'], ['terminal', 'Terminal'], ['browser', 'Safari / strona'], ['glass', 'Duża tafla szkła']], window.kind)}</select></label>
        ${field('title', 'Tytuł okna', window.title, escape, 'text')}
        <label class="motion-field">Treść (każda linia osobno)<textarea data-window-key="content" rows="4" maxlength="1000">${escape(window.content)}</textarea></label>
        <div class="motion-field-grid">${field('x', 'Pozycja X', window.x, escape, 'number', 0, 1080)}${field('y', 'Pozycja Y', window.y, escape, 'number', 0, 1920)}
          ${field('width', 'Szerokość', window.width, escape, 'number', 180, 1080)}${field('height', 'Wysokość', window.height, escape, 'number', 120, 1400)}</div>
        <div class="motion-field-grid">${field('startMs', 'Początek ms', window.startMs, escape, 'number', 0, Math.round((scene.end - scene.start) * 1000))}${field('endMs', 'Koniec ms', window.endMs, escape, 'number', 1, Math.round((scene.end - scene.start) * 1000))}</div>
        <label class="motion-field">Wejście<select data-window-key="enter">${options([['fade-down', 'Fade down'], ['slide-right', 'Z prawej'], ['pop', 'Pop'], ['cut', 'Cięcie']], window.enter)}</select></label>
        <label class="motion-field">Wyjście<select data-window-key="exit">${options([['fade', 'Fade'], ['slide-up', 'W górę'], ['shrink', 'Zmniejszenie'], ['cut', 'Cięcie']], window.exit || 'fade')}</select></label>
        <label class="motion-field">Krzywa ruchu<select data-window-key="easing">${options(easingOptions, window.easing || 'ease-out')}</select></label>
        ${slider('window', 'enterMs', 'Czas wejścia', window.enterMs, 0, 1800, 10, ' ms')}
        ${slider('window', 'exitMs', 'Czas wyjścia', window.exitMs, 0, 1800, 10, ' ms')}
        ${slider('window', 'travelPx', 'Droga ruchu', window.travelPx ?? 90, 0, 400, 1, ' px')}
        ${slider('window', 'scaleFrom', 'Skala początkowa', window.scaleFrom ?? 0.9, 0.5, 1.2, 0.01)}
        ${slider('window', 'lineDelayMs', 'Odstęp treści', window.lineDelayMs ?? 260, 0, 1000, 10, ' ms')}
        ${slider('window', 'contentSize', 'Wielkość treści', window.contentSize ?? 18, 12, 32, 1, ' px')}
        ${slider('window', 'radius', 'Zaokrąglenie', window.radius, 8, 80, 1, ' px')}
        ${slider('window', 'blur', 'Rozmycie szkła', window.blur, 0, 1, 0.01)}
        ${window.kind === 'glass' ? `${slider('window', 'shadowIntensity', 'Intensywność cienia', window.shadowIntensity ?? 0.45, 0, 1, 0.01)}
        ${slider('window', 'edgeOpacity', 'Biel ramki', window.edgeOpacity ?? 0.5, 0, 1, 0.01)}
        ${slider('window', 'edgeFeather', 'Wtapianie ramki', window.edgeFeather ?? 0.55, 0, 1, 0.01)}` : ''}
        ${slider('window', 'displacement', 'Refrakcja', window.displacement, 0, 120)}
        ${slider('window', 'saturation', 'Nasycenie', window.saturation, 50, 220, 1, '%')}
        ${slider('window', 'aberration', 'Aberracja', window.aberration, 0, 8, 0.1)}
        <button type="button" class="reel-text-button motion-remove-window" id="remove-mac-window">Usuń to okno</button>
      </div>` : '<p class="motion-empty">Dodaj okno Finder, edytora lub terminala. Powstanie na żywo w podglądzie.</p>'}
    </details>
    <div class="motion-save-row"><button type="button" class="btn accent" id="save-motion" ${dirty ? '' : 'disabled'}>Zapisz animacje${dirty ? ' •' : ''}</button><button type="button" class="reel-text-button" id="discard-motion" ${dirty ? '' : 'hidden'}>Odrzuć szkic</button><span>${dirty ? 'Niezapisane zmiany w lokalnym podglądzie' : 'Projekt zapisany'}</span></div>
  </section>`;
}

export function motionTimeline(reel, currentTime = 0) {
  const duration = reel.duration;
  return `<div class="motion-timeline" aria-label="Oś czasu filmu" style="--playhead:${Math.min(100, Math.max(0, currentTime / duration * 100))}%">
    <div class="motion-timeline-label">MONTAŻ <span>${Math.ceil(duration)} s</span></div>
    <div class="motion-timeline-tracks">
      <div class="motion-timeline-track"><span class="motion-video-track">WIDEO + AUDIO</span></div>
      <div class="motion-timeline-track">${reel.scenes.map((scene, index) => `<button type="button" class="motion-scene-block" data-timeline-scene="${index}" style="left:${scene.start / duration * 100}%;width:${(scene.end - scene.start) / duration * 100}%" title="Scena ${index + 1}: ${scene.start.toFixed(1)}–${scene.end.toFixed(1)} s">${String(index + 1).padStart(2, '0')}</button>`).join('')}</div>
      <div class="motion-timeline-track">${reel.scenes.flatMap(scene => (scene.motion?.windows || []).map(window => `<span class="motion-window-block" style="left:${(scene.start + window.startMs / 1000) / duration * 100}%;width:${(window.endMs - window.startMs) / 1000 / duration * 100}%" title="${escapeAttribute(window.title)}"></span>`)).join('')}</div>
      <div class="motion-timeline-track">${(reel.brandCards || []).map(card => `<span class="motion-brand-card-block" style="left:${card.startMs / 1000 / duration * 100}%;width:${(card.endMs - card.startMs) / 1000 / duration * 100}%" title="Plansza marki ${Math.round(card.startMs) / 1000}–${Math.round(card.endMs) / 1000} s"></span>`).join('')}</div>
      <i class="motion-playhead" aria-hidden="true"></i>
    </div>
  </div>`;
}
