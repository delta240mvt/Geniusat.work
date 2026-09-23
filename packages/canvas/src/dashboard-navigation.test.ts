import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';

test('sidebar opens publisher connections and keeps module navigation in sync', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {url: 'http://127.0.0.1:4188'});
  const {window} = dom;
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window', 'document', 'location', 'sessionStorage', 'FormData', 'CustomEvent', 'requestAnimationFrame']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {value: key === 'requestAnimationFrame' ? (callback: FrameRequestCallback) => setTimeout(callback, 0) : key === 'window' ? window : window[key as keyof typeof window], configurable: true});
  }
  let scrolledTo = '';
  window.HTMLElement.prototype.scrollIntoView = function () { scrolledTo = this.id; };
  const originalFetch = globalThis.fetch;
  const brainsDashboard = {
    runs: [{id: 'run-1', status: 'complete', analysisStatus: 'complete', startedAt: '2026-09-20T10:00:00.000Z', spentCredits: 18}],
    candidates: [{
      id: 'instagram:1', runId: 'run-1', platform: 'instagram', language: 'pl', sourceQuery: 'AI',
      sourceUrl: 'https://instagram.com/reel/1', text: 'Treść o AI', discoveryScore: 82,
      finalScore: null, enrichmentStatus: 'enriched', metrics: {views: 10000, likes: 500, comments: 20},
      comments: [{id: 'comment-1', author: 'viewer', text: 'Działa!', likes: 5}],
      transcript: {text: 'Transkrypcja rolki', language: 'pl', confidence: 0.95},
      analysis: {topic: 'Automatyzacja AI', summary: 'Konkretny przykład.', hook: 'Zobacz wynik', structure: ['Problem', 'Rozwiązanie'], viralMechanisms: [{label: 'konkret', evidenceRefs: ['instagram:1']}], commentThemes: [{label: 'zainteresowanie', evidenceRefs: ['comment-1']}], transcriptInsights: ['Jasny przekaz'], adaptationIdeas: ['Pokaż efekt'], risks: [], uncertainties: []},
    }],
    reports: [{runId: 'run-1', type: 'viral-intelligence', document: {synthesis: {recurringTopics: ['Automatyzacja'], recurringHooks: ['Zobacz wynik'], recurringStructures: ['Problem → rozwiązanie'], commentPatterns: ['Pytania'], platformDifferences: [], recommendations: ['Pokaż efekt']}}}],
  };
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === '/api/reels') return Response.json({reels: [], jobs: [], warnings: []});
    if (url === '/api/publisher/state') return Response.json({accounts: [], assets: [], posts: [], hosting: {configured: false}, timezone: 'Europe/Warsaw'});
    if (url === '/api/publisher/composio/capabilities') return Response.json({configured: false, capabilities: []});
    if (url === '/api/publisher/composio/connections') return Response.json({configured: false, connections: []});
    if (url === '/api/scale-calendar') return Response.json({entries: []});
    if (url === '/api/assets') return Response.json({assets: []});
    if (url === '/api/genius-brains') return Response.json(brainsDashboard);
    return Response.json([]);
  };
  const {unmountPublisher} = await import('../public/publisher.js');
  const {unmountReelStudio} = await import('../public/reels.js');
  const waitFor = async (predicate: () => boolean) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail('Dashboard did not settle');
  };
  try {
    await import('../public/app.js');
    await waitFor(() => Boolean(window.document.querySelector('#nav-scale')));

    window.document.querySelector<HTMLButtonElement>('#nav-scale')!.click();
    assert.equal(window.document.querySelector('#nav-scale')?.getAttribute('aria-expanded'), 'true');
    assert.equal(window.document.querySelector('#active-title')?.textContent, 'Studio rolek');

    window.document.querySelector<HTMLButtonElement>('#nav-scale-accounts')!.click();
    await waitFor(() => Boolean(window.document.querySelector('#composio-settings')));
    assert.equal(window.document.querySelector('#active-title')?.textContent, 'Połączenia');
    assert.equal(window.document.querySelector('.pub-heading h1')?.textContent, 'Połączenia');
    assert.equal(window.document.querySelector('#nav-scale-accounts')?.getAttribute('aria-current'), 'page');
    assert.equal(window.document.querySelector('.pub-tabs [aria-current="page"]')?.getAttribute('data-view'), 'accounts');

    window.document.dispatchEvent(new window.CustomEvent('genius:navigate-publisher', {detail: {view: 'library'}}));
    await waitFor(() => window.document.querySelector('.pub-tabs [aria-current="page"]')?.getAttribute('data-view') === 'library');
    assert.equal(window.document.querySelector('#nav-scale-assets')?.getAttribute('aria-current'), 'page');
    assert.equal(window.document.querySelector('#active-title')?.textContent, 'Materiały');
    assert.equal(window.document.querySelector('.pub-heading h1')?.textContent, 'Materiały');

    window.document.querySelector<HTMLButtonElement>('#pub-connections')!.click();
    assert.equal(window.document.querySelector('#nav-scale-accounts')?.getAttribute('aria-current'), 'page');
    assert.equal(window.document.querySelector('#active-title')?.textContent, 'Połączenia');

    window.document.querySelector<HTMLButtonElement>('#nav-content')!.click();
    window.document.querySelector<HTMLButtonElement>('#nav-content-ai-studio')!.click();
    assert.equal(window.document.querySelector('#active-title')?.textContent, 'AI Studio');
    assert.equal(window.document.querySelector('#nav-content-ai-studio')?.getAttribute('aria-current'), 'page');

    window.document.querySelector<HTMLButtonElement>('#nav-settings')!.click();
    window.document.querySelector<HTMLButtonElement>('#nav-settings-composio')!.click();
    await waitFor(() => scrolledTo === 'composio-settings');
    assert.equal(window.document.querySelector('#nav-settings-composio')?.getAttribute('aria-current'), 'page');

    window.document.querySelector<HTMLButtonElement>('#nav-brains')!.click();
    window.document.querySelector<HTMLButtonElement>('#nav-brains-summary')!.click();
    assert.match(window.document.querySelector('#tab-content')?.textContent || '', /Kredyty SocialCrawl/);
    window.document.querySelector<HTMLButtonElement>('#nav-brains-analysis')!.click();
    assert.match(window.document.querySelector('#tab-content')?.textContent || '', /Konkretny przykład/);
    assert.match(window.document.querySelector('#tab-content')?.textContent || '', /Działa!/);
    window.document.querySelector<HTMLButtonElement>('#nav-brains-trends')!.click();
    assert.match(window.document.querySelector('#tab-content')?.textContent || '', /Pokaż efekt/);
  } finally {
    unmountPublisher();
    unmountReelStudio();
    globalThis.fetch = originalFetch;
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
