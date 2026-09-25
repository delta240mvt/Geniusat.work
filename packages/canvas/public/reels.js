import {createWindow, defaultMotion, motionInspector, motionTimeline} from './reels-motion.js';

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
const timestamp = (seconds) =>
  `${Math.floor((seconds + .001) / 60)}:${String(Math.floor((seconds + .001) % 60)).padStart(2, '0')}`;
const drafts = new Map();
const playback = new Map();
const selectedScene = new Map();
const selectedWindow = new Map();
let catalog = {reels: [], jobs: [], warnings: []};
let selected = null;
let container = null;
let generation = 0;
let pollTimer;
let editing = false;
let submitting = false;
let applyWindowEdit = null;

async function api(url, body) {
  const response = await fetch(
    url,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        },
  );
  const data = await response
    .json()
    .catch(() => ({error: 'Serwer zwrócił nieprawidłową odpowiedź.'}));
  if (!response.ok)
    throw new Error(data.error || 'Nie udało się wykonać operacji.');
  return data;
}

function notice(message, error = false) {
  const element = container?.querySelector('#reel-notice');
  if (!element) return;
  element.textContent = message;
  element.className = `reel-notice${error ? ' error' : ''}`;
  element.hidden = !message;
}

function readDraft(id) {
  if (drafts.has(id)) return drafts.get(id);
  try {
    const draft = JSON.parse(sessionStorage.getItem(`reel-draft:${id}`));
    if (draft) drafts.set(id, draft);
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(id, draft) {
  if (draft) drafts.set(id, draft);
  else drafts.delete(id);
  try {
    if (draft)
      sessionStorage.setItem(`reel-draft:${id}`, JSON.stringify(draft));
    else sessionStorage.removeItem(`reel-draft:${id}`);
  } catch {
    /* In-memory drafts still protect edits when browser storage is unavailable. */
  }
}

function ensureDraft(reel) {
  const current = readDraft(reel.id);
  if (current) return structuredClone(current);
  return {title: reel.title, style: reel.style, scenes: structuredClone(reel.scenes)};
}

export function unmountReelStudio() {
  generation += 1;
  clearTimeout(pollTimer);
  applyWindowEdit = null;
  container = null;
}

export async function mountReelStudio(target) {
  unmountReelStudio();
  container = target;
  const currentGeneration = generation;
  target.innerHTML = '<p class="empty-state">Wczytuję projekty…</p>';
  try {
    const data = await api('/api/reels');
    if (currentGeneration !== generation) return;
    catalog = data;
    for (const reel of catalog.reels) {
      const draft = readDraft(reel.id);
      if (
        draft &&
        draft.title === reel.title &&
        draft.style === reel.style &&
        JSON.stringify(draft.scenes) === JSON.stringify(reel.scenes)
      )
        writeDraft(reel.id, null);
    }
    if (!catalog.reels.some((reel) => reel.id === selected))
      selected = catalog.reels[0]?.id;
    editing = Boolean(readDraft(selected));
    draw();
    const running = catalog.jobs.find((job) => job.status === 'running');
    if (running) watchJob(running);
  } catch (error) {
    if (currentGeneration !== generation) return;
    target.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p><button class="btn" id="retry-studio">Spróbuj ponownie</button></div>`;
    target.querySelector('#retry-studio').onclick = () =>
      mountReelStudio(target);
  }
}

function jobMessage(job) {
  if (job.status === 'failed')
    return (
      'Nie udało się zakończyć operacji. Możesz spróbować ponownie. Szczegóły: ' +
      job.message
    );
  if (job.status === 'complete')
    return job.action === 'render'
      ? 'Film jest gotowy. Pobierz MP4 poniżej.'
      : 'Projekt zapisany. Podgląd jest aktualny.';
  const progress = job.message?.match(/Render\s+(\d+)%/);
  if (progress)
    return `Eksport filmu: ${progress[1]}%. Możesz przejść do innego widoku.`;
  if (/napisów|Whisper/i.test(job.message))
    return 'Tworzę napisy z nagrania. To może potrwać kilka minut.';
  return job.action === 'render'
    ? 'Eksportuję film. Gotowy plik pojawi się tutaj.'
    : 'Przygotowuję projekt i podgląd…';
}

function watchJob(job) {
  clearTimeout(pollTimer);
  const currentGeneration = generation;
  notice(jobMessage(job));
  const check = async () => {
    try {
      const data = await api('/api/reels');
      if (currentGeneration !== generation) return;
      catalog = data;
      const latest = catalog.jobs.find((item) => item.id === job.id);
      if (!latest) {
        draw();
        notice(
          'Serwer został uruchomiony ponownie. Sprawdź zapisany projekt i w razie potrzeby ponów operację.',
          true,
        );
        return;
      }
      if (latest.status !== 'running') {
        if (latest.status === 'complete' && job.action === 'save')
          writeDraft(job.reelId, null);
        if (latest.status === 'complete' && job.action === 'create')
          selected = job.reelId;
        editing = Boolean(readDraft(selected));
        draw();
        notice(jobMessage(latest), latest.status === 'failed');
        return;
      }
      notice(jobMessage(latest));
      pollTimer = setTimeout(check, 1500);
    } catch {
      if (currentGeneration !== generation) return;
      notice(
        'Utracono połączenie ze studiem. Próbuję połączyć się ponownie…',
        true,
      );
      pollTimer = setTimeout(check, 3000);
    }
  };
  pollTimer = setTimeout(check, 1500);
}

async function submit(url, body) {
  if (submitting) return;
  submitting = true;
  container
    ?.querySelectorAll(
      '#render-reel, #prepare-reel, #edit-reel-form button[type="submit"]',
    )
    .forEach((button) => {
      button.disabled = true;
    });
  const currentGeneration = generation;
  try {
    const job = await api(url, body);
    if (currentGeneration !== generation) return;
    catalog.jobs.push(job);
    editing = false;
    draw();
    watchJob(job);
  } catch (error) {
    if (currentGeneration !== generation) return;
    draw();
    notice(error.message, true);
  } finally {
    submitting = false;
  }
}

function draw() {
  if (!container?.isConnected) return;
  applyWindowEdit = null;
  const reel = catalog.reels.find((item) => item.id === selected);
  const busy = catalog.jobs.some((job) => job.status === 'running');
  const draft = readDraft(selected);
  const editable = draft || reel;
  const time = playback.get(selected) || 0;
  const sceneIndex = Math.max(0, Math.min(editable?.scenes.length - 1 || 0,
    selectedScene.get(selected) ?? editable?.scenes.findIndex(scene => time >= scene.start && time < scene.end) ?? 0));
  const windowIndex = selectedWindow.get(selected) ?? 0;
  container.innerHTML = `
    <section class="reel-heading">
      <div><h1>Studio rolek</h1><p>Cały montaż na żywo. Tekst, okna Mac i Liquid Glass dostroisz przed eksportem.</p></div>
      <button class="btn accent" id="new-reel" ${busy ? 'disabled' : ''}>Nowa rolka <span aria-hidden="true">＋</span></button>
    </section>
    <div id="reel-notice" class="reel-notice" role="status" hidden></div>
    <div class="reel-workspace">
      <aside class="reel-library" aria-label="Twoje projekty">
        <div class="reel-panel-label">PROJEKTY <span>${catalog.reels.length}</span></div>
        ${
          catalog.reels
            .map(
              (item, index) => `
          <button class="reel-project ${item.id === selected ? 'selected' : ''}" data-reel="${item.id}" aria-pressed="${item.id === selected}">
            <span class="reel-project-number">${String(index + 1).padStart(2, '0')}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${timestamp(item.duration)} · ${item.style === 'signal' ? 'Kontrast' : 'Jasny'}<br>${readDraft(item.id) ? 'Niezapisane zmiany' : item.outputs.some((output) => !output.stale) ? 'Film gotowy' : 'Do eksportu'}</small>
          </button>`,
            )
            .join('') ||
          '<p class="empty-state">Tutaj pojawi się Twoja pierwsza rolka.</p>'
        }
      </aside>
      ${
        reel
          ? `
        <section class="reel-preview-panel">
          <div class="reel-panel-label">PODGLĄD <span>1080 × 1920 · 30 FPS</span></div>
          <div class="reel-preview-well">
            ${reel.previewUrl ? `<iframe id="reel-preview" src="${escapeHtml(reel.previewUrl)}&v=${Date.now()}" title="Podgląd rolki: ${escapeHtml(reel.title)}" allow="autoplay" sandbox="allow-scripts allow-same-origin"></iframe>` : '<div class="empty-state"><p>Podgląd nie jest jeszcze przygotowany.</p><button class="btn" id="prepare-reel">Przygotuj podgląd</button></div>'}
          </div>
          <div class="reel-player-controls">
            <button class="btn" id="play-reel" ${!reel.previewUrl ? 'disabled' : ''} aria-label="Odtwórz rolkę">▶</button>
            <input id="reel-seek" aria-label="Pozycja odtwarzania" type="range" min="0" max="${reel.duration}" step="0.0333" value="${time}" ${!reel.previewUrl ? 'disabled' : ''}>
            <span id="reel-time">${timestamp(time)} / ${timestamp(reel.duration)}</span>
          </div>
          ${motionTimeline({...reel, scenes: editable.scenes}, time)}
          <details class="reel-source"><summary>Nagranie źródłowe</summary><p>${escapeHtml(reel.sourceNote)}</p><p>${escapeHtml(reel.sourceFile)}</p></details>
        </section>
        <aside class="reel-settings">
          <div class="reel-panel-label">SCENY <button class="reel-text-button" id="edit-reel" ${busy ? 'disabled' : ''}>${editing ? 'Zamknij edycję' : 'Edytuj teksty'}</button></div>
          ${
            editing
              ? `<form id="edit-reel-form"><p class="reel-draft-note">Zmiany są zachowane w tej przeglądarce. Zapisz, aby odświeżyć podgląd i eksport.</p>
            <label class="reel-field">Tytuł projektu<input name="title" maxlength="100" value="${escapeHtml(editable.title)}" required></label>
            <label class="reel-field">Styl<select name="style"><option value="editorial" ${editable.style === 'editorial' ? 'selected' : ''}>Jasny</option><option value="signal" ${editable.style === 'signal' ? 'selected' : ''}>Kontrast</option></select></label>`
              : '<p class="reel-scene-hint">Kliknij scenę, aby ją obejrzeć.</p>'
          }
          <div class="reel-scenes">${(editing ? editable.scenes : reel.scenes)
            .map(
              (scene, index) => `
            <${editing ? 'div' : 'button'} ${editing ? '' : `type="button" data-seek="${scene.start}" data-scene-end="${scene.end}" data-scene-index="${index}"`} class="reel-scene ${sceneIndex === index ? 'inspected' : ''}">
              <span class="reel-scene-time">${timestamp(scene.start)}</span>
              <div>${editing ? `<button type="button" class="reel-scene-select" data-scene-index="${index}">Scena ${index + 1} · inspektor</button><label class="sr-only" for="scene-${index}">Tytuł sceny ${index + 1}</label><textarea id="scene-${index}" name="scene-${index}" maxlength="90" required>${escapeHtml(scene.title)}</textarea><label class="sr-only" for="detail-${index}">Opis sceny ${index + 1}</label><input id="detail-${index}" name="detail-${index}" maxlength="150" value="${escapeHtml(scene.detail)}">` : `<strong>${escapeHtml(scene.title).replaceAll('\n', ' ')}</strong>`}</div>
            </${editing ? 'div' : 'button'}>`,
            )
            .join('')}</div>
          ${editing ? '<div class="reel-edit-actions"><button class="btn accent" type="submit">Zapisz zmiany</button><button class="reel-text-button" id="discard-draft" type="button">Odrzuć zmiany</button></div></form>' : ''}
          <div id="motion-inspector-slot">${motionInspector(editable.scenes[sceneIndex], sceneIndex, windowIndex, Boolean(reel.motionConcept), escapeHtml, Boolean(draft))}</div>
          <div class="reel-export">
            <div class="reel-panel-label">GOTOWY FILM</div>
            <div class="reel-downloads">${reel.outputs.map((output) => `<a class="${output.stale ? 'stale' : 'reel-download-ready'}" href="${escapeHtml(output.url)}" download="${reel.id}-${output.engine}.mp4">↓ Pobierz MP4<span>${(output.bytes / 1024 / 1024).toFixed(1)} MB · ${escapeHtml(output.engine)}${output.stale ? ' · starsza wersja' : ''}</span></a>`).join('')}</div>
            ${reel.outputs.some(output => !output.stale) ? '<button class="btn accent" id="publish-reel" type="button">Zaplanuj lub opublikuj ↗</button>' : ''}
            <p class="reel-engine-help">Eksport Hyperframes · MP4 · 1080 × 1920</p>
            <button class="btn ${reel.outputs.some((output) => !output.stale) ? '' : 'accent'} reel-render-button" id="render-reel" ${busy || editing || readDraft(selected) ? 'disabled' : ''}>${busy ? 'Trwa przygotowanie…' : reel.outputs.length ? 'Eksportuj ponownie' : 'Eksportuj MP4'} <span aria-hidden="true">↗</span></button>
            ${readDraft(selected) ? '<p class="reel-engine-help">Zapisz zmiany przed eksportem.</p>' : ''}
          </div>
        </aside>`
          : '<div class="empty-state">Kliknij „Nowa rolka”, aby zacząć od nagrania z biblioteki.</div>'
      }
    </div>`;
  if (catalog.warnings?.length) notice(catalog.warnings.join(' '), true);
  container.querySelector('#new-reel').onclick = newReelForm;
  container.querySelectorAll('[data-reel]').forEach((button) => {
    button.onclick = () => {
      selected = button.dataset.reel;
      editing = Boolean(readDraft(selected));
      draw();
    };
  });
  if (!reel) return;
  container.querySelector('#publish-reel')?.addEventListener('click', () => {
    const output = reel.outputs.find(item => !item.stale);
    document.dispatchEvent(new CustomEvent('genius:navigate-publisher', {detail: {title: reel.title, path: decodeURIComponent(output.url.slice('/api/workspace/'.length))}}));
  });
  const frame = container.querySelector('#reel-preview');
  const send = (action, position, nextDraft) =>
    frame?.contentWindow?.postMessage(
      {type: 'delta-preview', action, time: position, draft: nextDraft},
      location.origin,
    );
  if (frame) frame.onload = () => {
    const currentDraft = readDraft(reel.id);
    if (currentDraft) send('update', undefined, currentDraft);
    send('seek', time);
  };
  const selectScene = (index) => {
    selectedScene.set(reel.id, index);
    selectedWindow.set(reel.id, 0);
    const current = readDraft(reel.id) || reel;
    const scene = current.scenes[index];
    container.querySelector('#motion-inspector-slot').innerHTML = motionInspector(scene, index, 0, Boolean(reel.motionConcept), escapeHtml, Boolean(readDraft(reel.id)));
    bindMotionInspector();
    container.querySelectorAll('.reel-scene').forEach((item, itemIndex) => item.classList.toggle('inspected', itemIndex === index));
    send('seek', Math.min(scene.end - 1 / 30, scene.start + 0.4));
  };
  container.querySelectorAll('[data-scene-index]').forEach(button => {
    button.onclick = () => selectScene(Number(button.dataset.sceneIndex));
  });
  function bindTimeline() {
    container.querySelectorAll('[data-timeline-scene]').forEach(button => {
      button.onclick = () => selectScene(Number(button.dataset.timelineScene));
    });
    const tracks = container.querySelector('.motion-timeline-tracks');
    if (tracks) tracks.onclick = event => {
      if (event.target.closest('[data-timeline-scene]')) return;
      const rect = tracks.getBoundingClientRect();
      send('seek', Math.max(0, Math.min(reel.duration - 1 / 30, (event.clientX - rect.left) / rect.width * reel.duration)));
    };
  }
  bindTimeline();
  function markDirty(nextDraft) {
    writeDraft(reel.id, nextDraft);
    send('update', undefined, nextDraft);
    const render = container.querySelector('#render-reel');
    if (render) render.disabled = true;
    const save = container.querySelector('#save-motion');
    if (save) { save.disabled = false; save.textContent = 'Zapisz animacje •'; }
    const discard = container.querySelector('#discard-motion');
    if (discard) discard.hidden = false;
    const status = container.querySelector('.motion-save-row span');
    if (status) status.textContent = 'Niezapisane zmiany w lokalnym podglądzie';
  }
  function changeMotion(change, redraw = false) {
    const nextDraft = ensureDraft(reel);
    const index = selectedScene.get(reel.id) ?? sceneIndex;
    const scene = nextDraft.scenes[index];
    scene.motion ||= defaultMotion(Boolean(reel.motionConcept), scene.title);
    change(scene.motion, scene);
    markDirty(nextDraft);
    if (redraw) {
      const windowIndex = selectedWindow.get(reel.id) ?? 0;
      container.querySelector('#motion-inspector-slot').innerHTML = motionInspector(scene, index, windowIndex, Boolean(reel.motionConcept), escapeHtml, true);
      bindMotionInspector();
      const timeline = container.querySelector('.motion-timeline');
      if (timeline) timeline.outerHTML = motionTimeline({...reel, scenes: nextDraft.scenes}, playback.get(reel.id) || 0);
      bindTimeline();
    }
  }
  function bindMotionInspector() {
    const slot = container.querySelector('#motion-inspector-slot');
    slot.querySelectorAll('[data-scene-option]').forEach(input => {
      input.onchange = () => changeMotion((_motion, scene) => { scene[input.dataset.sceneOption] = input.checked; });
    });
    slot.querySelectorAll('[data-motion-group]').forEach(input => {
      input.oninput = () => {
        const {motionGroup: group, motionKey: key} = input.dataset;
        changeMotion(motion => {
          const target = group === 'window' ? motion.windows[selectedWindow.get(reel.id) ?? 0] : motion[group];
          if (!target) return;
          target[key] = input.type === 'range' ? Number(input.value) : input.value;
        });
        const output = input.closest('label')?.querySelector('output');
        if (output) output.textContent = `${input.value}${output.textContent.replace(/^[\d.-]+/, '')}`;
      };
    });
    slot.querySelectorAll('[data-window-key]').forEach(input => {
      input.oninput = () => {
        const key = input.dataset.windowKey;
        if (input.type === 'number' && (!input.validity.valid || input.value === '')) return;
        changeMotion((motion, scene) => {
          const window = motion.windows[selectedWindow.get(reel.id) ?? 0];
          if (!window) return;
          window[key] = input.type === 'number' ? Number(input.value) : input.value;
          const duration = Math.round((scene.end - scene.start) * 1000);
          window.startMs = Math.min(window.startMs, duration - 1);
          window.endMs = Math.max(window.startMs + 1, Math.min(window.endMs, duration));
          window.x = Math.min(window.x, 1080 - window.width);
          window.y = Math.min(window.y, 1920 - window.height);
        }, key === 'kind');
        if (input.type === 'number') {
          const index = selectedScene.get(reel.id) ?? sceneIndex;
          input.value = (readDraft(reel.id).scenes[index].motion.windows[selectedWindow.get(reel.id) ?? 0][key]).toString();
        }
      };
    });
    slot.querySelectorAll('[data-select-window]').forEach(button => {
      button.onclick = () => {
        selectedWindow.set(reel.id, Number(button.dataset.selectWindow));
        const index = selectedScene.get(reel.id) ?? sceneIndex;
        const scene = (readDraft(reel.id) || reel).scenes[index];
        slot.innerHTML = motionInspector(scene, index, Number(button.dataset.selectWindow), Boolean(reel.motionConcept), escapeHtml, Boolean(readDraft(reel.id)));
        bindMotionInspector();
      };
    });
    slot.querySelectorAll('[data-add-window]').forEach(addButton => addButton.addEventListener('click', () => {
      const index = selectedScene.get(reel.id) ?? sceneIndex;
      changeMotion((motion, scene) => {
        motion.windows.push(createWindow(scene, motion.windows.length + 1, playback.get(reel.id) ?? scene.start, addButton.dataset.addWindow));
        selectedWindow.set(reel.id, motion.windows.length - 1);
      }, true);
      const scene = (readDraft(reel.id) || reel).scenes[index];
      const window = scene.motion.windows.at(-1);
      send('seek', scene.start + window.startMs / 1000 + Math.min(0.5, (window.endMs - window.startMs) / 2000));
    }));
    slot.querySelector('#remove-mac-window')?.addEventListener('click', () => {
      changeMotion(motion => {
        motion.windows.splice(selectedWindow.get(reel.id) ?? 0, 1);
        selectedWindow.set(reel.id, Math.max(0, motion.windows.length - 1));
      }, true);
    });
    slot.querySelector('#save-motion')?.addEventListener('click', () => {
      submit(`/api/reels/${reel.id}/save`, ensureDraft(reel));
    });
    slot.querySelector('#discard-motion')?.addEventListener('click', () => {
      writeDraft(reel.id, null);
      editing = false;
      draw();
    });
  }
  bindMotionInspector();
  applyWindowEdit = ({id, x, y, width, height}) => {
    if (typeof id !== 'string' || ![x, y, width, height].every(Number.isFinite)) return;
    const nextDraft = ensureDraft(reel);
    const index = nextDraft.scenes.findIndex(scene => scene.motion?.windows.some(window => window.id === id));
    if (index < 0) return;
    const windows = nextDraft.scenes[index].motion.windows;
    const windowIndex = windows.findIndex(window => window.id === id);
    const window = windows[windowIndex];
    window.width = Math.max(180, Math.min(1080, Math.round(width)));
    window.height = Math.max(120, Math.min(1400, Math.round(height)));
    window.x = Math.max(0, Math.min(1080 - window.width, Math.round(x)));
    window.y = Math.max(0, Math.min(1920 - window.height, Math.round(y)));
    selectedScene.set(reel.id, index);
    selectedWindow.set(reel.id, windowIndex);
    markDirty(nextDraft);
    container.querySelector('#motion-inspector-slot').innerHTML = motionInspector(nextDraft.scenes[index], index, windowIndex, Boolean(reel.motionConcept), escapeHtml, true);
    bindMotionInspector();
    container.querySelectorAll('.reel-scene').forEach((item, itemIndex) => item.classList.toggle('inspected', itemIndex === index));
  };
  container.querySelector('#play-reel').onclick = () => send('toggle');
  container.querySelector('#reel-seek').oninput = (event) =>
    send('seek', Number(event.target.value));
  container.querySelector('#render-reel').onclick = () =>
    submit(`/api/reels/${reel.id}/render`, {});
  const prepare = container.querySelector('#prepare-reel');
  if (prepare) {
    prepare.disabled = busy;
    prepare.onclick = () => submit(`/api/reels/${reel.id}/prepare`, {});
  }
  container.querySelector('#edit-reel').onclick = () => {
    editing = !editing;
    draw();
  };
  const form = container.querySelector('#edit-reel-form');
  if (form) {
    const capture = () => {
      const data = new FormData(form);
      const draft = ensureDraft(reel);
      draft.title = data.get('title');
      draft.style = data.get('style');
      draft.scenes = draft.scenes.map((scene, index) => ({
          ...scene,
          title: data.get(`scene-${index}`),
          detail: data.get(`detail-${index}`),
        }));
      markDirty(draft);
      return draft;
    };
    form.oninput = capture;
    form.onsubmit = (event) => {
      event.preventDefault();
      submit(`/api/reels/${reel.id}/save`, capture());
    };
    container.querySelector('#discard-draft').onclick = () => {
      writeDraft(reel.id, null);
      editing = false;
      draw();
    };
  }
}

async function newReelForm() {
  const dialog = document.createElement('dialog');
  dialog.className = 'reel-dialog';
  dialog.setAttribute('aria-labelledby', 'new-reel-title');
  dialog.innerHTML =
    '<div class="reel-panel-label">NOWA ROLKA<button type="button" aria-label="Zamknij">×</button></div><h2 id="new-reel-title">Wybierz nagranie</h2><div id="new-reel-body"><p>Wczytuję bibliotekę…</p></div>';
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclose = () => {
    dialog.remove();
    container?.querySelector('#new-reel')?.focus();
  };
  try {
    const library = await api('/api/reels/library');
    if (!dialog.isConnected) return;
    const available = library.filter((source) => source.usable);
    if (!available.length) {
      dialog.querySelector('#new-reel-body').innerHTML =
        '<p>Brak nagrań z dźwiękiem w bibliotece. Dodaj plik MOV lub MP4 do katalogu <code>apps/genius-content/public/input</code> i otwórz to okno ponownie.</p>';
      return;
    }
    dialog.querySelector('#new-reel-body').innerHTML = `<form>
      <label class="reel-field">Nagranie<select name="sourceId" required>${available.map((source) => `<option value="${source.sourceId}">${escapeHtml(source.name)} · ${timestamp(source.duration)}</option>`).join('')}</select></label>
      <p id="transcript-hint"></p>
      <label class="reel-field">Tytuł projektu<input name="title" required maxlength="100" placeholder="O czym jest ta rolka?"></label>
      <label class="reel-field">Styl<select name="style"><option value="editorial">Jasny</option><option value="signal">Kontrast</option></select></label>
      <p id="create-error" role="alert"></p><button class="btn accent" type="submit">Utwórz rolkę</button>
    </form>`;
    const select = dialog.querySelector('[name="sourceId"]');
    const hint = () => {
      const source = available.find((item) => item.sourceId === select.value);
      dialog.querySelector('#transcript-hint').textContent =
        source.transcriptReady
          ? 'Napisy są gotowe. Utworzymy sceny i podgląd.'
          : 'Najpierw utworzymy napisy lokalnie. To może potrwać kilka minut.';
    };
    select.onchange = hint;
    hint();
    dialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const button = event.target.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const job = await api(
          '/api/reels',
          Object.fromEntries(new FormData(event.target)),
        );
        dialog.close();
        catalog.jobs.push(job);
        editing = false;
        draw();
        watchJob(job);
      } catch (error) {
        dialog.querySelector('#create-error').textContent = error.message;
        button.disabled = false;
      }
    };
  } catch (error) {
    if (dialog.isConnected)
      dialog.querySelector('#new-reel-body').textContent = error.message;
  }
}

window.addEventListener('message', (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== container?.querySelector('#reel-preview')?.contentWindow
  )
    return;
  if (event.data?.type === 'delta-preview-error') { notice(event.data.message, true); return; }
  if (event.data?.type === 'delta-preview-window-edit') { applyWindowEdit?.(event.data); return; }
  if (event.data?.type !== 'delta-preview-state') return;
  const reel = catalog.reels.find((item) => item.id === selected);
  if (!reel || !Number.isFinite(event.data.time)) return;
  playback.set(selected, event.data.time);
  container.querySelector('#reel-seek').value = event.data.time;
  container.querySelector('#reel-time').textContent =
    `${timestamp(event.data.time)} / ${timestamp(reel.duration)}`;
  const timeline = container.querySelector('.motion-timeline');
  if (timeline) timeline.style.setProperty('--playhead', `${Math.max(0, Math.min(100, event.data.time / reel.duration * 100))}%`);
  const play = container.querySelector('#play-reel');
  play.textContent = event.data.paused ? '▶' : 'Ⅱ';
  play.setAttribute(
    'aria-label',
    event.data.paused ? 'Odtwórz rolkę' : 'Wstrzymaj rolkę',
  );
  container.querySelectorAll('[data-seek]').forEach((button) => {
    button.classList.toggle(
      'current',
      event.data.time >= Number(button.dataset.seek) &&
        event.data.time < Number(button.dataset.sceneEnd),
    );
  });
});
