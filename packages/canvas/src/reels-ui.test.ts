import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';

test('studio preserves drafts and ignores responses after navigation', async () => {
  const dom = new JSDOM('<main id="workspace"></main>', {url: 'http://127.0.0.1:4188'});
  const {window} = dom;
  for (const key of ['window', 'document', 'location', 'sessionStorage', 'FormData']) {
    Object.defineProperty(globalThis, key, {value: key === 'window' ? window : window[key], configurable: true});
  }
  const preset = {
    version:1,id:'example',title:'Przykładowa rolka',sourceId:'example',sourceFile:'example.mp4',
    style:'editorial',preferredEngine:'hyperframes',sourceNote:'Sztuczne dane testowe.',
    clips:[{start:0,end:16.6}],words:[],
    scenes:[{start:0,end:16.6,kicker:'01 / PRZYKŁAD',title:'Przykładowa scena',graphic:'wave',accent:'turquoise',detail:'Treść testowa.',labels:[]}],
  };
  const reel = {...preset, duration: 16.6, previewUrl: null, outputs: []};
  const catalog = {reels: [reel], jobs: [], warnings: []};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(catalog));
  const {mountReelStudio, unmountReelStudio} = await import('../public/reels.js');
  const target = window.document.querySelector('#workspace');
  try {
    await mountReelStudio(target);
    assert.equal(target.querySelector('#reel-engine'),null);
    assert.match(target.textContent,/Eksport Hyperframes/);
    assert.doesNotMatch(target.textContent,/Remotion/);
    target.querySelector('#edit-reel').click();
    const input = target.querySelector('[name="title"]');
    input.value = 'Niezapisany tytuł';
    input.dispatchEvent(new window.Event('input', {bubbles: true}));
    unmountReelStudio();
    await mountReelStudio(target);
    assert.equal(target.querySelector('[name="title"]').value, 'Niezapisany tytuł');
    assert.equal(target.querySelector('#render-reel').disabled, true);
    target.querySelector('#discard-draft').click();
    assert.equal(target.querySelector('#edit-reel-form'), null);
    assert.equal(target.querySelector('#render-reel').disabled, false);

    let resolveRequest;
    globalThis.fetch = () => new Promise(resolve => {resolveRequest = resolve;});
    const pendingMount = mountReelStudio(target);
    unmountReelStudio();
    target.textContent = 'Inny widok';
    resolveRequest(new Response(JSON.stringify(catalog)));
    await pendingMount;
    assert.equal(target.textContent, 'Inny widok');
  } finally {
    unmountReelStudio();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
