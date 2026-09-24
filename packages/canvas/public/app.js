import {mountReelStudio, unmountReelStudio} from './reels.js';
import {showConfiguration} from './configuration.js';
import {mountPublisher, unmountPublisher, openStudioPublication} from './publisher.js';
import {getNavigationState, isNavigationItemActive, navigationSections} from './navigation.js';
const primaryNav = document.getElementById('primary-nav');
const runList = document.getElementById('run-list');
const activeKicker = document.getElementById('active-kicker');
const activeTitle = document.getElementById('active-title');
const subTabs = document.getElementById('sub-tabs');
const tabContent = document.getElementById('tab-content');
const metricRuns = document.getElementById('metric-runs');
const metricNodes = document.getElementById('metric-nodes');
const metricPrompts = document.getElementById('metric-prompts');
const metricAssets = document.getElementById('metric-assets');
let brainsAnalysisCandidateId = null;

const appConfig = {
  brains: {
    title: 'Viral Intelligence',
    tabs: [
      ['summary', 'Run summary'],
      ['radar', 'Viral radar'],
      ['analysis', 'Analiza treści'],
      ['trends', 'Trends / report'],
    ],
  },
  content: {
    title: 'Motion Studio',
    tabs: [
      ['studio', 'Studio rolek'],
      ['flow', 'Przepływ'],
      ['prompts', 'Scenariusze'],
      ['render', 'Podgląd plików'],
    ],
  },
  scale: {
    title: 'Publikacje',
    tabs: [
      ['calendar', 'Kalendarz'],
      ['runs', 'Historia'],
      ['assets', 'Materiały'],
      ['accounts', 'Połączenia'],
    ],
  },
};

const contentWorkspaces = [
  ['ai-studio', 'AI Studio'],
  ['reels', 'Starsze rolki'],
];

const state = {
  activeApp: 'content',
  activeSubTab: 'studio',
  activeContentWorkspace: 'reels',
  openNavSection: 'content',
  activeNavigationItemId: 'content-studio',
  pendingNavigationAnchor: null,
  selectedRunId: {
    brains: null,
    contentAiStudio: null,
    contentReels: null,
    scale: null,
  },
  contentRuns: [],
  brainsRuns: [],
  brainsIntelligence: {generatedAt: null, runs: [], candidates: [], reports: []},
  calendar: {generatedAt: null, entries: []},
  assets: {generatedAt: null, assets: []},
  analysisList: [],
  loadWarnings: [],
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
};

const getNavigationItem = (itemId) =>
  navigationSections.flatMap((section) => section.items).find((item) => item.id === itemId) || null;

const navigateToItem = (item) => {
  const section = navigationSections.find((candidate) => candidate.items.some((child) => child.id === item.id));
  state.activeNavigationItemId = item.id;
  state.openNavSection = section?.id || state.openNavSection;
  if (item.action === 'health') {
    showConfiguration();
    renderPrimaryNavigation();
    return;
  }
  state.activeApp = item.app;
  if (item.workspace) state.activeContentWorkspace = item.workspace;
  state.activeSubTab = item.tab || appConfig[item.app].tabs[0][0];
  state.pendingNavigationAnchor = item.anchor || null;
  render();
};

const renderPrimaryNavigation = () => {
  const fallbackState = getNavigationState(state);
  const activeItemId = state.activeNavigationItemId || fallbackState.activeItem;
  const openSection = state.openNavSection ?? fallbackState.openSection;
  primaryNav.replaceChildren();

  navigationSections.forEach((section, index) => {
    const group = createElement('section', `nav-group${openSection === section.id ? ' open' : ''}${openSection === section.id ? ' current' : ''}`);
    const heading = createElement('button', 'nav-group-heading');
    heading.type = 'button';
    heading.setAttribute('aria-expanded', String(openSection === section.id));
    heading.setAttribute('aria-controls', `nav-${section.id}-items`);
    heading.id = `nav-${section.id}`;
    heading.append(
      createElement('span', 'nav-group-icon', section.icon),
      createElement('span', 'nav-group-copy', section.label),
      createElement('span', 'nav-group-eyebrow', section.eyebrow),
      createElement('span', 'nav-chevron', openSection === section.id ? '⌃' : '⌄'),
    );
    heading.addEventListener('click', () => {
      state.openNavSection = openSection === section.id ? '' : section.id;
      renderPrimaryNavigation();
      document.getElementById(heading.id)?.focus();
    });
    group.appendChild(heading);

    const itemList = createElement('div', 'nav-submenu');
    itemList.id = `nav-${section.id}-items`;
    itemList.setAttribute('aria-label', `${section.label} — widoki`);
    section.items.forEach((item) => {
      const button = createElement('button', `nav-subitem${isNavigationItemActive(item, {activeItem: activeItemId}) ? ' active' : ''}`);
      button.type = 'button';
      button.id = `nav-${item.id}`;
      button.setAttribute('aria-current', isNavigationItemActive(item, {activeItem: activeItemId}) ? 'page' : 'false');
      button.append(createElement('span', 'nav-subitem-dot'), createElement('span', null, item.label));
      button.addEventListener('click', () => navigateToItem(item));
      itemList.appendChild(button);
    });
    group.appendChild(itemList);
    primaryNav.appendChild(group);
    if (index < navigationSections.length - 1) primaryNav.appendChild(createElement('div', 'nav-divider'));
  });
};

const formatDateTime = (value, timezone) => {
  if (!value) {
    return 'no date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  try {
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || undefined,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('pl-PL', {dateStyle: 'medium', timeStyle: 'short'}).format(date);
  }
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getStatusClassName = (status) =>
  `status ${String(status || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')}`;

const getStatusText = (status) => String(status || 'preview').replace(/_/g, ' ');

const formatShortTime = (value, timezone) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('pl-PL', {hour: '2-digit', minute: '2-digit', timeZone: timezone || undefined}).format(date);
  } catch {
    return new Intl.DateTimeFormat('pl-PL', {hour: '2-digit', minute: '2-digit'}).format(date);
  }
};

const clampText = (value, length = 90) => {
  const text = String(value || '').trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
};

const fetchJson = async (url, fallback) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json().catch(() => fallback);
};

const getContentWorkspaceLabel = (workspaceKind = state.activeContentWorkspace) =>
  contentWorkspaces.find(([kind]) => kind === workspaceKind)?.[1] || 'AI Studio';

const getContentSelectedKey = () => (state.activeContentWorkspace === 'reels' ? 'contentReels' : 'contentAiStudio');

const getContentRunsForActiveWorkspace = () =>
  state.contentRuns.filter((run) => (run.workspaceKind || 'ai-studio') === state.activeContentWorkspace);

const getRunsForActiveApp = () => {
  if (state.activeApp === 'content') {
    return getContentRunsForActiveWorkspace();
  }
  if (state.activeApp === 'brains') {
    return state.brainsIntelligence.runs.map((run) => ({
      id: run.id,
      title: `Genius@Brains · ${run.id}`,
      status: run.status,
      updatedAt: new Date(run.finishedAt || run.startedAt || 0).getTime(),
      rootPath: 'apps/genius-brains/output/viral',
    }));
  }
  return state.calendar.entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    status: entry.status,
    updatedAt: new Date(entry.scheduledAt).getTime(),
    rootPath: entry.projectName,
    nodes: [],
    prompts: [],
    artifacts: entry.assets || [],
    calendarEntry: entry,
  }));
};

const getSelectedRun = () => {
  const runs = getRunsForActiveApp();
  const selectedId = state.activeApp === 'content' ? state.selectedRunId[getContentSelectedKey()] : state.selectedRunId[state.activeApp];
  return runs.find((run) => run.id === selectedId) || runs[0] || null;
};

const setSelectedDefaults = () => {
  state.selectedRunId.brains ||= state.brainsIntelligence.runs[0]?.id ?? state.brainsRuns[0]?.id ?? null;
  state.selectedRunId.contentAiStudio ||= state.contentRuns.find((run) => (run.workspaceKind || 'ai-studio') === 'ai-studio')?.id ?? null;
  state.selectedRunId.contentReels ||= state.contentRuns.find((run) => run.workspaceKind === 'reels')?.id ?? null;
  state.selectedRunId.scale ||= state.calendar.entries[0]?.id ?? null;
};

const renderMetrics = () => {
  const runs = getRunsForActiveApp();
  const selectedRun = getSelectedRun();
  const assets =
    state.activeApp === 'scale'
      ? state.assets.assets.length
      : (selectedRun?.artifacts || selectedRun?.calendarEntry?.assets || []).length;

  metricRuns.textContent = String(runs.length);
  metricNodes.textContent = String((selectedRun?.nodes || []).length);
  metricPrompts.textContent = String(
    state.activeApp === 'brains'
      ? state.brainsIntelligence.candidates.filter((candidate) => candidate.runId === selectedRun?.id).length
      : state.activeApp === 'content'
        ? (selectedRun?.prompts || []).length
        : state.analysisList.length,
  );
  metricAssets.textContent = String(assets);
};

const renderRunList = () => {
  const runs = getRunsForActiveApp();
  const selectedRun = getSelectedRun();
  runList.innerHTML = '';

  if (state.activeApp === 'content') {
    const switcher = createElement('div', 'content-workspace-switch');
    contentWorkspaces.forEach(([kind, label]) => {
      const count = state.contentRuns.filter((run) => (run.workspaceKind || 'ai-studio') === kind).length;
      const button = createElement('button', `workspace-tab${state.activeContentWorkspace === kind ? ' active' : ''}`);
      button.type = 'button';
      button.append(createElement('span', null, label), createElement('b', null, String(count)));
      button.addEventListener('click', () => {
        state.activeContentWorkspace = kind;
        state.activeSubTab = kind === 'ai-studio' ? 'flow' : 'studio';
        state.activeNavigationItemId = kind === 'ai-studio' ? 'content-ai-studio' : 'content-studio';
        state.openNavSection = 'content';
        render();
      });
      switcher.appendChild(button);
    });
    runList.appendChild(switcher);
  }

  if (!runs.length) {
    runList.appendChild(createElement('div', 'empty-state', `Brak danych preview dla ${state.activeApp === 'content' ? getContentWorkspaceLabel() : 'tej aplikacji'}.`));
    return;
  }

  runs.forEach((run) => {
    const button = createElement('button', `run-card${run.id === selectedRun?.id ? ' active' : ''}`);
    button.type = 'button';
    button.appendChild(createElement('div', 'run-title', run.title || run.id));
    if (state.activeApp === 'content') {
      button.appendChild(createElement('div', 'run-source-label', run.workspaceLabel || getContentWorkspaceLabel(run.workspaceKind)));
    }
    button.append(createElement('div', 'run-meta', run.rootPath || run.calendarEntry?.projectName || run.id), createElement('span', getStatusClassName(run.status), getStatusText(run.status)));
    button.addEventListener('click', () => {
      if (state.activeApp === 'content') {
        state.selectedRunId[getContentSelectedKey()] = run.id;
      } else {
        state.selectedRunId[state.activeApp] = run.id;
      }
      render();
    });
    runList.appendChild(button);
  });
};

const renderSubTabs = () => {
  const tabs = appConfig[state.activeApp].tabs.filter(([id])=>id!=='studio'||state.activeContentWorkspace==='reels');
  if (!tabs.some(([id]) => id === state.activeSubTab)) {
    state.activeSubTab = tabs[0][0];
  }

  subTabs.innerHTML = '';
  tabs.forEach(([id, label]) => {
    const button = createElement('button', `sub-tab${id === state.activeSubTab ? ' active' : ''}`, label);
    button.type = 'button';
    button.setAttribute('aria-selected', String(id === state.activeSubTab));
    button.addEventListener('click', () => {
      state.activeSubTab = id;
      render();
    });
    subTabs.appendChild(button);
  });
};

const renderNodeFlow = (nodes) => {
  const panel = createElement('section', 'panel');
  const header = createElement('div', 'node-panel-header');
  header.append(
    createElement('div', 'panel-title', 'Node flow'),
    createElement('span', 'status ready', `${nodes?.length || 0} nodes`),
  );
  panel.appendChild(header);
  const body = createElement('div', 'panel-body node-flow-body');

  if (!nodes?.length) {
    body.appendChild(createElement('div', 'empty-state', 'Brak node flow dla wybranego runu.'));
  } else {
    nodes.forEach((node, index) => {
      const row = createElement('article', `node-row node-${node.type || 'unknown'}`);
      row.appendChild(createElement('div', 'node-index', String(index + 1)));
      const copy = createElement('div', 'node-copy');
      const meta = createElement('div', 'node-meta-row');
      meta.append(
        createElement('span', 'node-kind', node.type || 'node'),
        createElement('span', getStatusClassName(node.status), getStatusText(node.status)),
      );
      copy.append(
        meta,
        createElement('div', 'node-title', node.label),
        createElement('div', 'node-summary', node.summary || ''),
      );
      const nodePath = node.sourcePath || node.outputPath;
      if (nodePath) {
        copy.appendChild(createElement('div', 'node-path', nodePath));
      }
      row.appendChild(copy);
      body.appendChild(row);
      if (index < nodes.length - 1) {
        body.appendChild(createElement('div', 'flow-line'));
      }
    });
  }

  panel.appendChild(body);
  return panel;
};

const renderPromptList = (prompts) => {
  const panel = createElement('section', 'panel');
  panel.appendChild(createElement('div', 'panel-title', 'Prompts'));
  const body = createElement('div', 'panel-body');

  if (!prompts?.length) {
    body.appendChild(createElement('div', 'empty-state', 'Brak promptów w artefaktach runu.'));
  } else {
    prompts.forEach((prompt) => {
      const row = createElement('article', 'prompt-row');
      row.append(
        createElement('div', 'prompt-title', prompt.title),
        createElement('div', 'prompt-path', prompt.path),
        createElement('pre', 'prompt-body', prompt.bodyPreview || ''),
      );
      body.appendChild(row);
    });
  }

  panel.appendChild(body);
  return panel;
};

const renderAssetCards = (assets) => {
  const grid = createElement('div', 'asset-grid');
  if (!assets?.length) {
    grid.appendChild(createElement('div', 'empty-state', 'Brak assetów preview.'));
    return grid;
  }

  assets.forEach((asset) => {
    const card = createElement('article', 'asset-row');
    appendMediaElement(card, asset, 'asset-preview-media');
    card.append(createElement('div', 'asset-title', asset.name || asset.id));
    card.append(createElement('div', 'asset-meta', asset.path || asset.localPath || ''));
    card.append(createElement('div', 'asset-meta', formatBytes(asset.sizeBytes)));
    grid.appendChild(card);
  });

  return grid;
};

const renderContentFlow = (run) => {
  const layout = createElement('div', 'content-grid');
  layout.append(renderNodeFlow(run?.nodes || []), renderPromptList(run?.prompts || []), renderAssetPanel(getMediaAssets(run?.artifacts || []), 'Media preview'));
  tabContent.replaceChildren(layout);
};

const renderContentPrompts = (run) => {
  const layout = createElement('div', 'detail-grid');
  layout.append(renderPromptList(run?.prompts || []), renderNodeFlow(run?.nodes || []));
  tabContent.replaceChildren(layout);
};

const getPromptStage = (prompt) => String(prompt?.metadata?.stage || prompt?.title || '').toLowerCase();

const getPromptShotId = (prompt) => prompt?.metadata?.shotId || prompt?.path?.split('/shots/')[1]?.split('/')[0] || 'run-level';

const getAssetShotId = (asset) => asset?.metadata?.shotId || asset?.path?.split('/').slice(-2, -1)[0] || 'run-level';

const getAssetStage = (asset) => String(asset?.metadata?.stage || asset?.name || '').toLowerCase();

const isImageAsset = (asset) => ['png', 'jpg', 'jpeg', 'webp'].includes(String(asset?.type || '').toLowerCase());

const isVideoAsset = (asset) => ['mp4', 'mov', 'm4v', 'webm'].includes(String(asset?.type || '').toLowerCase());

const IMAGE_PROMPT_STAGES = new Set(['image-prompt']);
const SHOT_CONTEXT_STAGES = new Set(['shot-prompt', 'shot-spec', 'dialogue', 'preview-prompt', 'scene-contract', 'script', 'edit-brief', 'flow', 'personas', 'context']);

const getMediaAssets = (assets) => assets.filter((asset) => isImageAsset(asset) || isVideoAsset(asset));

const appendMediaElement = (target, asset, className) => {
  if (isImageAsset(asset) && asset.publicUrl) {
    const image = document.createElement('img');
    image.className = className;
    image.src = asset.publicUrl;
    image.alt = asset.altText || asset.name || 'Generated image';
    target.appendChild(image);
    return;
  }
  if (isVideoAsset(asset) && asset.publicUrl) {
    const video = document.createElement('video');
    video.className = className;
    video.src = asset.publicUrl;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    target.appendChild(video);
    return;
  }
  target.appendChild(createElement('div', 'asset-thumb', asset.type?.toUpperCase?.() || 'FILE'));
};

const buildRenderFlowSteps = (run) => {
  const groups = new Map();
  const runLevelPrompts = [];
  const runLevelAssets = [];
  const runRootName = run?.rootPath?.split('/').pop();
  const ensureGroup = (shotId) => {
    const key = shotId || 'run-level';
    if (!groups.has(key)) {
      groups.set(key, {shotId: key, prompts: [], assets: []});
    }
    return groups.get(key);
  };

  (run?.prompts || []).forEach((prompt) => {
    const shotId = getPromptShotId(prompt);
    if (shotId === 'run-level') {
      runLevelPrompts.push(prompt);
    } else {
      ensureGroup(shotId).prompts.push(prompt);
    }
  });
  (run?.artifacts || []).forEach((asset) => {
    const shotId = getAssetShotId(asset);
    if (shotId === runRootName || shotId === run?.title || shotId === 'run-level') {
      runLevelAssets.push(asset);
      return;
    }
    ensureGroup(shotId).assets.push(asset);
  });

  const shotGroups = [...groups.values()];
  if (!shotGroups.length && runLevelPrompts.length) {
    shotGroups.push({shotId: 'run-level', prompts: [], assets: []});
  }

  return shotGroups
    .map((group) => {
      const prompts = [...runLevelPrompts, ...group.prompts];
      return {
        ...group,
        prompts,
        runLevelPrompts,
        runLevelAssets,
        shotPrompts: group.prompts,
        imagePrompts: group.prompts.filter((prompt) => IMAGE_PROMPT_STAGES.has(getPromptStage(prompt))),
        videoPrompts: group.prompts.filter((prompt) => getPromptStage(prompt) === 'video-prompt'),
        contextPrompts: prompts.filter((prompt) => SHOT_CONTEXT_STAGES.has(getPromptStage(prompt))),
        imageOutputs: group.assets.filter(isImageAsset),
        videoOutputs: group.assets.filter(isVideoAsset),
        otherOutputs: group.assets.filter((asset) => !isImageAsset(asset) && !isVideoAsset(asset)),
      };
    })
    .sort((left, right) => left.shotId.localeCompare(right.shotId, undefined, {numeric: true}));
};

const appendPromptCard = (target, prompt, label) => {
  const card = createElement('article', 'render-prompt-card');
  card.append(
    createElement('div', 'flow-label', label),
    createElement('div', 'prompt-title', prompt.title || 'Prompt'),
    createElement('div', 'prompt-path', prompt.path || ''),
    createElement('pre', 'prompt-body', prompt.bodyPreview || ''),
  );
  target.appendChild(card);
};

const appendPromptDetails = (target, prompt, label, open = false) => {
  const details = document.createElement('details');
  details.className = 'render-prompt-details';
  details.open = open;
  const summary = document.createElement('summary');
  summary.append(
    createElement('span', 'flow-label', label),
    createElement('span', 'prompt-title', prompt?.title || 'Prompt'),
    createElement('span', 'prompt-path', prompt?.path || ''),
  );
  details.append(summary);
  appendPromptTrace(details, prompt);
  details.append(createElement('pre', 'prompt-body', prompt?.bodyPreview || ''));
  target.appendChild(details);
};

const appendTraceRows = (target, rows, className = 'trace-list') => {
  const cleanRows = rows.filter(([, value]) => value !== undefined && value !== null && String(value).length > 0);
  if (!cleanRows.length) {
    return;
  }
  const list = createElement('div', className);
  cleanRows.forEach(([label, value]) => {
    const row = createElement('div', 'trace-row');
    row.append(createElement('b', null, label), createElement('span', null, String(value)));
    list.appendChild(row);
  });
  target.appendChild(list);
};

const appendPromptTrace = (target, prompt) => {
  if (!prompt?.metadata) {
    return;
  }
  if (prompt.metadata.generatedOutputPath) {
    appendTraceRows(target, [['generated output', prompt.metadata.generatedOutputPath]], 'trace-list prompt-trace');
  }
  const runtimeInputs = prompt.metadata.runtimeInputs || null;
  if (runtimeInputs && typeof runtimeInputs === 'object') {
    appendTraceRows(
      target,
      [
        ['Veo image input', runtimeInputs.firstFramePath],
        ['Veo lastFrame input', runtimeInputs.lastFramePath],
        ['Veo raw output', runtimeInputs.rawVideoPath],
        ['trimmed output', runtimeInputs.trimmedVideoPath],
      ],
      'trace-list prompt-trace',
    );
  }
};

const appendAssetPreview = (target, asset, label) => {
  const card = createElement('article', 'render-asset-card');
  card.append(createElement('div', 'flow-label', label), createElement('div', 'asset-title', asset.name || asset.id));
  appendMediaElement(card, asset, isImageAsset(asset) ? 'render-image' : 'render-video');
  card.append(createElement('div', 'asset-meta', asset.path || ''), createElement('div', 'asset-meta', formatBytes(asset.sizeBytes)));
  target.appendChild(card);
};

const renderFlowColumn = (title, bodyRenderer) => {
  const panel = createElement('section', 'panel pad');
  panel.appendChild(createElement('div', 'panel-title', title));
  const body = createElement('div', 'render-flow-column');
  bodyRenderer(body);
  if (!body.children.length) {
    body.appendChild(createElement('div', 'empty-state', 'Brak danych dla tego etapu.'));
  }
  panel.appendChild(body);
  return panel;
};

const getFileName = (item) => String(item?.metadata?.fileName || item?.name || item?.path || '').toLowerCase();

const contextOrder = new Map([
  ['script', 1],
  ['personas', 2],
  ['character-anchor', 3],
  ['scene-contract', 4],
  ['scene-rationale', 5],
  ['shot-spec', 6],
  ['shot-prompt', 7],
  ['dialogue', 8],
  ['audio-notes', 9],
  ['preview-prompt', 10],
  ['edit-brief', 11],
  ['flow', 12],
  ['context', 20],
]);

const describeInjection = (prompt) => {
  const stage = getPromptStage(prompt);
  const fileName = getFileName(prompt);
  if (stage === 'script') {
    return {role: 'Source script / dialogue base', injectedInto: 'Shot prompt -> image prompts -> video prompt'};
  }
  if (stage === 'personas' || stage === 'character-anchor') {
    return {role: 'Character identity and continuity', injectedInto: 'Image prompts + video prompt'};
  }
  if (stage === 'scene-contract') {
    return {role: 'Scene boundaries, continuity rules', injectedInto: 'Every image prompt + video prompt'};
  }
  if (stage === 'scene-rationale') {
    return {role: 'Why this scene/shot exists', injectedInto: 'Shot prompt context before generation'};
  }
  if (stage === 'shot-spec') {
    return {role: 'Shot id, frame mode, persona, continuity mode', injectedInto: 'Image prompt selection + video prompt'};
  }
  if (stage === 'shot-prompt') {
    return {role: 'Shot-level generation brief', injectedInto: 'nano-banana image prompts + veo video prompt'};
  }
  if (stage === 'dialogue') {
    return {role: 'Spoken line for this shot', injectedInto: 'Video prompt dialogue/audio'};
  }
  if (stage === 'audio-notes') {
    return {role: 'Audio/dialogue delivery notes', injectedInto: 'Video prompt audio section'};
  }
  if (stage === 'preview-prompt') {
    return {role: 'Preview/reference prompt', injectedInto: 'Run-level preview before generation'};
  }
  if (stage === 'edit-brief' || stage === 'flow') {
    return {role: 'Ordering and edit intent', injectedInto: 'Shot sequence planning'};
  }
  return {role: fileName || 'Context source', injectedInto: 'Generation context'};
};

const targetLabelForPrompt = (prompt) => {
  const stage = getPromptStage(prompt);
  if (stage === 'image-prompt') {
    return getFileName(prompt).includes('last') ? 'Nano Banana last-frame prompt' : 'Nano Banana first-frame prompt';
  }
  if (stage === 'video-prompt') {
    return 'Veo request prompt';
  }
  if (stage === 'shot-spec') {
    return 'Shot manifest';
  }
  if (stage === 'shot-prompt') {
    return 'Shot generation brief';
  }
  if (stage === 'dialogue') {
    return 'Dialogue source';
  }
  return prompt?.title || stage || 'Prompt';
};

const buildInjectionTargets = (prompt, step) => {
  const stage = getPromptStage(prompt);
  const shotPrompts = step.shotPrompts || [];
  const allGenerationPrompts = [...step.imagePrompts, ...step.videoPrompts];
  let targets = [];

  if (['script', 'personas', 'character-anchor', 'scene-contract'].includes(stage)) {
    targets = [...shotPrompts.filter((item) => ['shot-spec', 'shot-prompt', 'dialogue'].includes(getPromptStage(item))), ...allGenerationPrompts];
  } else if (stage === 'scene-rationale' || stage === 'edit-brief' || stage === 'flow' || stage === 'audio-notes') {
    targets = allGenerationPrompts;
  } else if (stage === 'shot-spec' || stage === 'shot-prompt') {
    targets = allGenerationPrompts;
  } else if (stage === 'dialogue') {
    targets = step.videoPrompts;
  } else if (stage === 'preview-prompt') {
    targets = [];
  } else {
    targets = allGenerationPrompts;
  }

  const uniqueTargets = [];
  const seen = new Set();
  targets.forEach((target) => {
    if (!target?.path || seen.has(target.path) || target.path === prompt.path) {
      return;
    }
    seen.add(target.path);
    uniqueTargets.push(target);
  });

  return uniqueTargets;
};

const appendInjectionTargets = (target, prompt, step) => {
  const targets = buildInjectionTargets(prompt, step);
  const list = createElement('div', 'target-list');
  if (!targets.length) {
    list.appendChild(createElement('div', 'target-empty', 'No direct generation target in this shot.'));
  }
  targets.forEach((item, index) => {
    const row = createElement('div', 'target-row');
    row.append(
      createElement('span', 'target-step', String(index + 1)),
      createElement('b', null, targetLabelForPrompt(item)),
      createElement('span', 'prompt-path', item.path || ''),
    );
    if (item.metadata?.generatedOutputPath) {
      row.appendChild(createElement('span', 'target-output', `outputs -> ${item.metadata.generatedOutputPath}`));
    }
    if (item.metadata?.runtimeInputs) {
      const inputs = item.metadata.runtimeInputs;
      row.appendChild(createElement('span', 'target-output', `uses image -> ${inputs.firstFramePath || 'missing first frame'}`));
      if (inputs.lastFramePath) {
        row.appendChild(createElement('span', 'target-output', `uses lastFrame -> ${inputs.lastFramePath}`));
      }
      if (inputs.rawVideoPath) {
        row.appendChild(createElement('span', 'target-output', `outputs -> ${inputs.rawVideoPath}`));
      }
    }
    list.appendChild(row);
  });
  target.appendChild(list);
};

const sortContextPrompts = (prompts) =>
  [...prompts].sort((left, right) => {
    const leftStage = getPromptStage(left);
    const rightStage = getPromptStage(right);
    return (contextOrder.get(leftStage) ?? 20) - (contextOrder.get(rightStage) ?? 20) || left.path.localeCompare(right.path);
  });

const promptMatchesAssetVariant = (prompt, asset) => {
  const promptName = getFileName(prompt);
  const assetName = getFileName(asset);
  if (promptName.includes('first')) {
    return assetName.includes('first');
  }
  if (promptName.includes('last')) {
    return assetName.includes('last');
  }
  return true;
};

const createSequenceStep = (number, title, subtitle, className = '') => {
  const header = createElement('div', 'render-sequence-header');
  header.append(createElement('span', 'marker active', String(number)), createElement('div', 'panel-title', title));
  if (subtitle) {
    header.appendChild(createElement('div', 'render-sequence-subtitle', subtitle));
  }
  const body = createElement('div', 'render-sequence-body');
  const section = createElement('section', `render-sequence-step${className ? ` ${className}` : ''}`);
  section.append(header, body);
  return {section, body};
};

const appendPromptToAssetsStep = (target, number, title, prompt, assets, outputLabel) => {
  const {section, body} = createSequenceStep(number, title, prompt?.path || 'missing prompt');
  const promptPanel = createElement('div', 'render-sequence-panel prompt-panel');
  if (prompt) {
    appendPromptDetails(promptPanel, prompt, getPromptStage(prompt), false);
    appendPromptTrace(promptPanel, prompt);
  } else {
    promptPanel.appendChild(createElement('div', 'empty-state', 'Brak promptu dla tego kroku.'));
  }

  const outputPanel = createElement('div', 'render-sequence-panel output-panel');
  if (assets.length) {
    assets.forEach((asset) => appendAssetPreview(outputPanel, asset, outputLabel || getAssetStage(asset)));
  } else {
    outputPanel.appendChild(createElement('div', 'empty-state', 'Brak outputu dla tego kroku.'));
  }

  body.append(promptPanel, createElement('div', 'render-arrow', '->'), outputPanel);
  target.appendChild(section);
};

const appendContextStep = (target, number, prompts, step) => {
  const orderedPrompts = sortContextPrompts(prompts);
  const {section, body} = createSequenceStep(number, 'Injection map: inputs before generation', `Exact destinations for ${step.shotId}`, 'context-step');
  const contextPanel = createElement('div', 'injection-map');
  if (orderedPrompts.length) {
    const header = createElement('div', 'injection-row injection-head');
    header.append(createElement('div', null, 'Source'), createElement('div', null, 'Role'), createElement('div', null, 'Exact destinations'), createElement('div', null, 'Source details'));
    contextPanel.appendChild(header);
    orderedPrompts.forEach((prompt) => {
      const injection = describeInjection(prompt);
      const row = createElement('div', 'injection-row');
      const source = createElement('div', 'injection-source');
      source.append(createElement('span', 'flow-label', getPromptStage(prompt)), createElement('b', null, prompt.title || 'Prompt'), createElement('span', 'prompt-path', prompt.path || ''));
      const targets = createElement('div', 'injection-target');
      targets.appendChild(createElement('div', 'target-summary', injection.injectedInto));
      appendInjectionTargets(targets, prompt, step);
      row.append(source, createElement('div', 'injection-role', injection.role), targets);
      const detailsCell = createElement('div', 'injection-details-cell');
      appendPromptDetails(detailsCell, prompt, 'source', false);
      row.appendChild(detailsCell);
      contextPanel.appendChild(row);
    });
  } else {
    contextPanel.appendChild(createElement('div', 'empty-state', 'Brak kontekstu dla tego shotu.'));
  }
  body.appendChild(contextPanel);
  target.appendChild(section);
};

const appendShotSequence = (target, step) => {
  const sequence = createElement('div', 'render-sequence');
  let stepNumber = 1;
  appendContextStep(sequence, stepNumber, step.contextPrompts, step);
  stepNumber += 1;

  step.imagePrompts.forEach((prompt) => {
    const outputs = step.imageOutputs.filter((asset) => promptMatchesAssetVariant(prompt, asset));
    appendPromptToAssetsStep(sequence, stepNumber, `Image generation: ${prompt.title || 'prompt'}`, prompt, outputs, 'generated-image');
    stepNumber += 1;
  });

  if (!step.imagePrompts.length && step.imageOutputs.length) {
    appendPromptToAssetsStep(sequence, stepNumber, 'Generated images without matched prompt', null, step.imageOutputs, 'generated-image');
    stepNumber += 1;
  }

  step.videoPrompts.forEach((prompt) => {
    appendPromptToAssetsStep(sequence, stepNumber, `Video generation: ${prompt.title || 'prompt'}`, prompt, step.videoOutputs, 'generated-video');
    stepNumber += 1;
  });

  if (!step.videoPrompts.length && step.videoOutputs.length) {
    appendPromptToAssetsStep(sequence, stepNumber, 'Video outputs without matched prompt', null, step.videoOutputs, 'generated-video');
  }

  target.appendChild(sequence);
};

const renderContentPreview = (run) => {
  const steps = buildRenderFlowSteps(run);
  const shell = createElement('div', 'render-preview-shell');
  const header = createElement('section', 'panel pad render-run-header');
  header.append(
    createElement('div', 'panel-title', run?.title || 'Render Preview'),
    createElement('div', 'mono', run?.rootPath || 'no run selected'),
  );
  const stats = createElement('div', 'render-stats');
  [
    ['Shots', steps.length],
    ['All prompts', run?.prompts?.length || 0],
    ['Image files', steps.reduce((sum, step) => sum + step.imageOutputs.length, 0)],
    ['Video files', run?.artifacts?.filter(isVideoAsset).length || 0],
    ['Video prompts', run?.prompts?.filter((prompt) => getPromptStage(prompt) === 'video-prompt').length || 0],
  ].forEach(([label, value]) => {
    const tile = createElement('div', 'sidebar-card');
    tile.append(createElement('div', 'small', label), createElement('b', null, String(value)));
    stats.appendChild(tile);
  });
  header.appendChild(stats);
  shell.appendChild(header);

  if (!steps.length) {
    shell.appendChild(createElement('div', 'empty-state', 'Brak danych render preview dla wybranego runu.'));
    tabContent.replaceChildren(shell);
    return;
  }

  steps.forEach((step, index) => {
    const row = createElement('section', 'render-flow-step');
    const stepHeader = createElement('div', 'render-step-header');
    stepHeader.append(
      createElement('span', 'marker active', String(index + 1)),
      createElement('div', 'panel-title', step.shotId),
      createElement('span', 'status active', `${step.prompts.length} prompts`),
      createElement('span', 'status ready', `${step.assets.length} outputs`),
    );

    const sequenceBody = createElement('div', 'render-sequence-wrap');
    appendShotSequence(sequenceBody, step);

    row.append(stepHeader, sequenceBody);
    shell.appendChild(row);
  });

  tabContent.replaceChildren(shell);
};

const brainsCandidatesForRun = (run) => state.brainsIntelligence.candidates.filter((candidate) => !run || candidate.runId === run.id);

const appendExternalLink = (parent, url, label = 'Otwórz źródło') => {
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.textContent = label;
  link.className = 'source-link';
  parent.appendChild(link);
};

const appendInsightList = (parent, title, items) => {
  if (!Array.isArray(items) || !items.length) return;
  const section = createElement('section', 'brain-insight-section');
  section.appendChild(createElement('h3', null, title));
  const list = createElement('ul');
  items.forEach((item) => {
    const detail = typeof item === 'string' ? item : `${item.label || ''}${item.evidenceRefs?.length ? ` · źródła: ${item.evidenceRefs.join(', ')}` : ''}`;
    list.appendChild(createElement('li', null, detail));
  });
  section.appendChild(list);
  parent.appendChild(section);
};

const renderBrainsSummary = (run) => {
  const selected = state.brainsIntelligence.runs.find((item) => item.id === run?.id) || state.brainsIntelligence.runs[0];
  const candidates = brainsCandidatesForRun(selected);
  const panel = createElement('section', 'panel pad');
  panel.append(
    createElement('div', 'panel-title', 'Podsumowanie analizy viralowej'),
    createElement('div', 'small', selected ? `${selected.id} · ${formatDateTime(selected.finishedAt || selected.startedAt)}` : 'Brak uruchomionej analizy.'),
  );
  const grid = createElement('div', 'metrics-grid brain-stats');
  [['Wyszukiwanie', selected?.status || 'brak'], ['Analiza AI', selected?.analysisStatus || 'oczekuje'], ['Znalezione treści', String(candidates.length)], ['Kredyty SocialCrawl', String(selected?.spentCredits ?? 0)]]
    .forEach(([label, value]) => {
      const card = createElement('article', 'brain-stat-card');
      card.append(createElement('span', null, label), createElement('strong', null, value));
      grid.appendChild(card);
    });
  panel.appendChild(grid);
  const criteria = selected?.researchCriteria;
  if (criteria && typeof criteria.analysisFocus === 'string') {
    const research = createElement('section', 'brain-analysis-result');
    research.append(
      createElement('h2', null, 'Cel badania LinkedIn'),
      createElement('p', null, criteria.analysisFocus),
    );
    const searches = Array.isArray(criteria.searches) ? criteria.searches.map((search) => search.query || search.fromMemberUrn || search.fromCompanyId).filter(Boolean) : [];
    appendInsightList(research, 'Zapytania i źródła', searches);
    const filters = criteria.filters || {};
    const thresholds = [
      filters.minLikes !== undefined ? `Min. polubień: ${filters.minLikes}` : null,
      filters.minComments !== undefined ? `Min. komentarzy: ${filters.minComments}` : null,
      Array.isArray(filters.anyKeywords) && filters.anyKeywords.length ? `Słowa: ${filters.anyKeywords.join(', ')}` : null,
    ].filter(Boolean);
    appendInsightList(research, 'Filtry', thresholds);
    panel.appendChild(research);
  }
  if (selected?.errorSummary) panel.appendChild(createElement('pre', 'source-block', selected.errorSummary));
  tabContent.replaceChildren(panel);
};

const renderBrainsRadar = (run) => {
  const candidates = brainsCandidatesForRun(run);
  const panel = createElement('section', 'panel pad');
  panel.appendChild(createElement('div', 'panel-title', `Viral radar · ${candidates.length} kandydatów`));
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<tr><th>Wynik</th><th>Platforma</th><th>Treść</th><th>Zaangażowanie</th><th>Status</th></tr>';
  candidates.forEach((candidate) => {
    const row = document.createElement('tr');
    const score = document.createElement('td'); score.textContent = String(candidate.finalScore ?? candidate.discoveryScore);
    const platform = document.createElement('td'); platform.textContent = `${candidate.platform} / ${candidate.language}`;
    const content = document.createElement('td'); content.textContent = clampText(candidate.text || candidate.sourceQuery, 120); appendExternalLink(content, candidate.sourceUrl);
    const metrics = document.createElement('td'); metrics.textContent = `wyświetlenia ${candidate.metrics.views ?? '-'} · polubienia ${candidate.metrics.likes ?? '-'} · komentarze ${candidate.metrics.comments ?? candidate.metrics.replies ?? '-'}`;
    const status = document.createElement('td'); status.appendChild(createElement('span', getStatusClassName(candidate.enrichmentStatus), getStatusText(candidate.enrichmentStatus)));
    row.append(score, platform, content, metrics, status); table.appendChild(row);
  });
  const tableScroll = createElement('div', 'brain-table-scroll');
  tableScroll.appendChild(table);
  panel.appendChild(tableScroll);
  if (!candidates.length) panel.appendChild(createElement('div', 'empty-state', 'Brak wyników viral radar.'));
  tabContent.replaceChildren(panel);
};

const renderBrainsAnalysis = (run) => {
  const candidates = brainsCandidatesForRun(run);
  const candidate = candidates.find((item) => item.id === brainsAnalysisCandidateId) || candidates[0];
  brainsAnalysisCandidateId = candidate?.id || null;
  const panel = createElement('section', 'panel pad');
  panel.appendChild(createElement('div', 'panel-title', candidate ? `Analiza · ${candidate.id}` : 'Analiza treści'));
  if (!candidate) {
    panel.appendChild(createElement('div', 'empty-state', 'Brak wybranych kandydatów do analizy.'));
  } else {
    const selector = document.createElement('select');
    selector.className = 'select-pill';
    selector.setAttribute('aria-label', 'Wybierz analizowany viral');
    candidates.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.platform} · ${item.id}`;
      option.selected = item.id === candidate.id;
      selector.appendChild(option);
    });
    selector.onchange = () => {
      brainsAnalysisCandidateId = selector.value;
      renderBrainsAnalysis(run);
    };
    panel.appendChild(selector);
    appendExternalLink(panel, candidate.sourceUrl, 'Obejrzyj oryginał');
    panel.appendChild(createElement('p', null, candidate.text || candidate.sourceQuery));
    if (candidate.transcript) {
      const transcript = createElement('details', 'panel-body');
      transcript.open = true;
      transcript.append(
        createElement('summary', null, `Transkrypcja · ${candidate.transcript.language || 'język nieustalony'} · confidence ${candidate.transcript.confidence ?? '-'}`),
        createElement('p', 'source-block', candidate.transcript.text),
      );
      panel.appendChild(transcript);
    }
    if (candidate.analysis) {
      const analysis = candidate.analysis;
      const result = createElement('div', 'brain-analysis-result');
      result.append(
        createElement('h2', null, analysis.topic || 'Wnioski z analizy'),
        createElement('p', null, analysis.summary || ''),
        createElement('p', 'brain-hook', `Hook: ${analysis.hook || '—'}`),
      );
      appendInsightList(result, 'Struktura', analysis.structure);
      appendInsightList(result, 'Mechanizmy viralowe', analysis.viralMechanisms);
      appendInsightList(result, 'Sygnały w komentarzach', analysis.commentThemes);
      appendInsightList(result, 'Wnioski z transkrypcji', analysis.transcriptInsights);
      appendInsightList(result, 'Pomysły do Genius@Content', analysis.adaptationIdeas);
      appendInsightList(result, 'Ryzyka i niepewności', [...(analysis.risks || []), ...(analysis.uncertainties || [])]);
      panel.appendChild(result);
    } else {
      panel.appendChild(createElement('p', 'empty-state', 'Ta treść czeka na analizę Codex.'));
    }
    const comments = createElement('div', 'panel-body');
    comments.appendChild(createElement('h3', null, `Komentarze · ${candidate.comments.length}`));
    candidate.comments.forEach((comment) => comments.appendChild(createElement('article', 'comment-row', `${comment.author || 'anon'} · ${comment.likes ?? 0} likes\n${comment.text}`)));
    if (!candidate.comments.length) comments.appendChild(createElement('p', 'empty-state', 'Brak pobranych komentarzy.'));
    panel.appendChild(comments);
  }
  tabContent.replaceChildren(panel);
};

const renderBrainsTrends = (_run) => {
  const panel = createElement('section', 'panel pad');
  panel.appendChild(createElement('div', 'panel-title', 'Trendy i raporty'));
  state.brainsIntelligence.reports.forEach((report) => {
    const document = report.document || {};
    const synthesis = document.synthesis || {};
    const article = createElement('article', 'brain-report');
    article.appendChild(createElement('h2', null, `Raport · ${report.runId}`));
    appendInsightList(article, 'Powtarzające się tematy', synthesis.recurringTopics);
    appendInsightList(article, 'Skuteczne otwarcia', synthesis.recurringHooks);
    appendInsightList(article, 'Struktury', synthesis.recurringStructures);
    appendInsightList(article, 'Wzorce w komentarzach', synthesis.commentPatterns);
    appendInsightList(article, 'Różnice między platformami', synthesis.platformDifferences);
    appendInsightList(article, 'Rekomendacje dla Genius@Content', synthesis.recommendations);
    panel.appendChild(article);
  });
  if (!state.brainsIntelligence.reports.length) panel.appendChild(createElement('div', 'empty-state', 'Brak raportu syntezy. Uruchom analizę Codex po crawl runie.'));
  tabContent.replaceChildren(panel);
};

const renderComments = (run) => {
  const layout = createElement('div', 'detail-grid');
  const commentsPanel = createElement('section', 'panel');
  commentsPanel.appendChild(createElement('div', 'panel-title', 'Top comments'));
  const body = createElement('div', 'panel-body');
  (run?.comments || []).forEach((comment) => {
    const row = createElement('article', 'comment-row');
    row.append(
      createElement('div', 'comment-text', comment.text),
      createElement('div', 'comment-meta', `${comment.author || 'anon'} / score ${comment.engagementScore ?? '-'} / likes ${comment.likeCount ?? 0}`),
    );
    if (comment.whySelected) {
      row.appendChild(createElement('div', 'comment-meta', comment.whySelected));
    }
    body.appendChild(row);
  });
  if (!body.children.length) {
    body.appendChild(createElement('div', 'empty-state', 'Brak komentarzy do podglądu.'));
  }
  commentsPanel.appendChild(body);
  layout.append(commentsPanel, renderAssetPanel(run?.artifacts || [], 'Brains artifacts'));
  tabContent.replaceChildren(layout);
};

const renderChannels = (run) => {
  const layout = createElement('div', 'detail-grid');
  const videosPanel = createElement('section', 'panel');
  videosPanel.appendChild(createElement('div', 'panel-title', 'Videos / channels'));
  const body = createElement('div', 'panel-body');
  (run?.videos || []).forEach((video) => {
    const row = createElement('article', 'video-row');
    row.append(
      createElement('div', 'video-title', video.title),
      createElement('div', 'comment-meta', `${video.videoId || 'no id'} / views ${video.viewCount ?? '-'} / comments ${video.commentCount ?? '-'}`),
    );
    body.appendChild(row);
  });
  if (!body.children.length) {
    body.appendChild(createElement('div', 'empty-state', 'Brak video/channel data.'));
  }
  videosPanel.appendChild(body);
  layout.append(videosPanel, renderCommentsSummary(run));
  tabContent.replaceChildren(layout);
};

const renderCommentsSummary = (run) => {
  const panel = createElement('section', 'panel');
  panel.appendChild(createElement('div', 'panel-title', 'Signals'));
  const body = createElement('div', 'panel-body');
  const comments = run?.comments || [];
  const totalLikes = comments.reduce((sum, item) => sum + (item.likeCount || 0), 0);
  body.append(
    createElement('pre', 'source-block', JSON.stringify({comments: comments.length, totalLikes, artifacts: run?.artifacts?.length || 0}, null, 2)),
  );
  panel.appendChild(body);
  return panel;
};

const renderInsights = (run) => {
  const panel = createElement('section', 'panel');
  panel.appendChild(createElement('div', 'panel-title', 'Preview insights'));
  const body = createElement('div', 'panel-body');
  const comments = run?.comments || [];
  const best = [...comments].sort((left, right) => (right.engagementScore || 0) - (left.engagementScore || 0))[0];
  body.append(
    createElement('article', 'node-row'),
    createElement('pre', 'source-block', JSON.stringify({
      run: run?.title || null,
      strongestComment: best?.text || null,
      videos: run?.videos?.length || 0,
      comments: comments.length,
      status: run?.status || 'empty',
    }, null, 2)),
  );
  panel.appendChild(body);
  tabContent.replaceChildren(panel);
};

const renderAssetPanel = (assets, title) => {
  const panel = createElement('section', 'panel');
  panel.append(createElement('div', 'panel-title', title), createElement('div', 'panel-body'));
  panel.querySelector('.panel-body').appendChild(renderAssetCards(assets));
  return panel;
};

const getCalendarMonthModel = (entries) => {
  const datedEntries = entries
    .map((entry) => ({entry, date: new Date(entry.scheduledAt)}))
    .filter(({date}) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const anchor = datedEntries[0]?.date || new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells = [];

  weekdayLabels.forEach((label) => {
    cells.push({type: 'label', label});
  });

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push({type: 'blank'});
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const dayEntries = datedEntries
      .filter(({date: entryDate}) => entryDate.getFullYear() === year && entryDate.getMonth() === month && entryDate.getDate() === day)
      .map(({entry}) => entry);
    cells.push({type: 'day', day, entries: dayEntries});
  }

  return {
    label: new Intl.DateTimeFormat('pl-PL', {month: 'long', year: 'numeric'}).format(firstDay),
    cells,
  };
};

const renderSelectedScalePost = (entry) => {
  const panel = createElement('section', 'panel pad');
  if (!entry) {
    panel.append(createElement('div', 'panel-title', 'Selected Post'), createElement('p', 'empty-state', 'Brak wybranego wpisu.'));
    return panel;
  }

  panel.appendChild(createElement('div', 'panel-title', 'Selected Post'));
  panel.querySelector('.panel-title').appendChild(createElement('span', getStatusClassName(entry.status), getStatusText(entry.status)));
  panel.append(
    createElement('p', null, `${entry.platforms?.join(', ') || 'Platform'} · ${formatDateTime(entry.scheduledAt, entry.timezone)} · ${entry.timezone || 'local'}`),
    createElement('h3', null, 'Body Preview'),
    createElement('p', null, entry.bodyPreview || 'No body preview.'),
  );

  const inspector = createElement('div', 'inspector-list');
  [
    ['Project', entry.projectName || entry.projectId || '-'],
    ['Source', JSON.stringify(entry.source || {}, null, 2)],
    ['Latest run', entry.latestRun ? `${entry.latestRun.type} / ${entry.latestRun.status} / ${entry.latestRun.message || ''}` : 'No run recorded'],
  ].forEach(([label, value]) => {
    const row = createElement('div', 'inspector-row');
    row.append(createElement('b', null, label), createElement('span', null, value), createElement('span', null, ''));
    inspector.appendChild(row);
  });
  panel.appendChild(inspector);

  const assets = renderAssetCards(entry.assets || []);
  const assetsTitle = createElement('div', 'panel-title');
  assetsTitle.style.marginTop = '14px';
  assetsTitle.textContent = 'Assets';
  panel.append(assetsTitle, assets);
  return panel;
};

const renderScaleSummary = () => {
  const panel = createElement('aside', null);
  const entries = state.calendar.entries || [];
  const passed = entries.filter((entry) => ['ready', 'published', 'ok', 'preview'].includes(String(entry.status).toLowerCase())).length;
  const failed = entries.filter((entry) => ['failed', 'blocked'].includes(String(entry.status).toLowerCase())).length;
  const nextEntry = [...entries]
    .filter((entry) => !Number.isNaN(new Date(entry.scheduledAt).getTime()))
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())[0];

  const summary = createElement('div', 'panel pad');
  summary.append(
    createElement('div', 'panel-title', 'Run Summary'),
    createElement('p', null, `${entries.length} runs · ${passed} passed · ${failed} failed`),
    createElement('p', 'small', `Next scheduled: ${nextEntry ? formatDateTime(nextEntry.scheduledAt, nextEntry.timezone) : 'none'}`),
  );

  const history = createElement('div', 'panel pad');
  history.style.marginTop = '14px';
  history.appendChild(createElement('div', 'panel-title', 'Recent Publish History'));
  entries.slice(0, 5).forEach((entry) => {
    const row = createElement('p', null, entry.title || entry.id);
    row.appendChild(createElement('span', getStatusClassName(entry.status), getStatusText(entry.status)));
    history.appendChild(row);
  });

  const settings = createElement('div', 'panel pad');
  settings.style.marginTop = '14px';
  settings.append(
    createElement('div', 'panel-title', 'Auto Publish Settings'),
    createElement('p', null, 'Auto Publish Off'),
    createElement('p', 'small', 'Preview-only: publish, dry-run and reschedule actions are disabled.'),
  );
  panel.append(summary, history, settings);
  return panel;
};

const renderScaleCalendar = () => {
  const layout = createElement('div', 'scale-grid');
  const selected = state.calendar.entries.find((entry) => entry.id === state.selectedRunId.scale) || state.calendar.entries[0] || null;
  const calendarPanel = createElement('section', 'panel pad');
  const month = getCalendarMonthModel(state.calendar.entries || []);
  const title = createElement('div', 'panel-title', month.label);
  const titleActions = createElement('span', null);
  titleActions.append(createElement('button', 'btn', 'Week'), createElement('button', 'btn accent', 'Month'), createElement('button', 'btn', 'List'));
  title.appendChild(titleActions);
  const filters = createElement('div', 'filter-row');
  filters.append(
    createElement('span', 'select-pill', `Items · ${state.calendar.entries.length}`),
    createElement('span', 'select-pill', `Assets · ${state.assets.assets.length}`),
    createElement('span', 'select-pill', 'Status · All'),
  );
  const grid = createElement('div', 'month-grid');
  month.cells.forEach((cell) => {
    const day = createElement('div', `day${cell.type === 'blank' ? ' muted-day' : ''}`);
    if (cell.type === 'label') {
      day.appendChild(createElement('b', null, cell.label));
    } else if (cell.type === 'day') {
      day.appendChild(createElement('b', null, String(cell.day)));
      cell.entries.forEach((entry) => {
        const event = createElement(
          'button',
          `event ${String(entry.status || 'draft').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}${entry.id === selected?.id ? ' active' : ''}`,
          `${formatShortTime(entry.scheduledAt, entry.timezone)} ${clampText(entry.title, 26)}`,
        );
        event.type = 'button';
        event.addEventListener('click', () => {
          state.selectedRunId.scale = entry.id;
          render();
        });
        day.appendChild(event);
      });
    }
    grid.appendChild(day);
  });
  calendarPanel.append(title, filters, grid, createElement('div', 'small', '● draft   ● ready   ● dry_run_ok   ● published   ● failed'));

  const upcoming = createElement('section', 'panel pad');
  upcoming.style.marginTop = '14px';
  upcoming.appendChild(createElement('div', 'panel-title', 'Upcoming Posts'));
  const table = createElement('table', 'table');
  table.innerHTML = '<tr><th>Date & Time</th><th>Content</th><th>Status</th><th>Last Run</th></tr>';
  state.calendar.entries.slice(0, 8).forEach((entry) => {
    const row = document.createElement('tr');
    const date = document.createElement('td');
    date.textContent = formatDateTime(entry.scheduledAt, entry.timezone);
    const content = document.createElement('td');
    content.textContent = entry.title || entry.bodyPreview || entry.id;
    const status = document.createElement('td');
    status.appendChild(createElement('span', getStatusClassName(entry.status), getStatusText(entry.status)));
    const latest = document.createElement('td');
    latest.textContent = entry.latestRun ? `${entry.latestRun.type} / ${entry.latestRun.status}` : '-';
    row.append(date, content, status, latest);
    table.appendChild(row);
  });
  upcoming.appendChild(table);
  const left = createElement('div');
  left.append(calendarPanel, upcoming);
  layout.append(left, renderSelectedScalePost(selected), renderScaleSummary());
  tabContent.replaceChildren(layout);
};

const renderScaleRuns = () => {
  const panel = createElement('section', 'panel');
  panel.appendChild(createElement('div', 'panel-title', 'Scale run history'));
  const body = createElement('div', 'panel-body');
  state.calendar.entries.forEach((entry) => {
    const latestRun = entry.latestRun || {};
    const row = createElement('article', 'calendar-row');
    row.append(
      createElement('div', 'calendar-title', entry.title),
      createElement('div', 'calendar-meta', `${latestRun.type || 'scheduled'} / ${latestRun.status || entry.status}`),
      createElement('div', 'calendar-meta', latestRun.message || entry.bodyPreview || ''),
      createElement('span', getStatusClassName(latestRun.status || entry.status), getStatusText(latestRun.status || entry.status)),
    );
    body.appendChild(row);
  });
  if (!body.children.length) {
    body.appendChild(createElement('div', 'empty-state', 'Brak run history dla Scale.'));
  }
  panel.appendChild(body);
  tabContent.replaceChildren(panel);
};

const renderScaleAssets = () => {
  tabContent.replaceChildren(renderAssetPanel(state.assets.assets, 'Preview assets'));
};

const renderActiveTabContent = () => {
  unmountReelStudio();
  unmountPublisher();
  const run = getSelectedRun();
  if (state.activeApp === 'scale' && state.activeSubTab === 'old-calendar') {
    renderScaleCalendar();
  } else if (state.activeApp === 'scale') {
    const publisherView = {
      calendar: 'calendar',
      runs: 'list',
      assets: 'library',
      accounts: 'accounts',
    }[state.activeSubTab] || 'calendar';
    const anchor = state.pendingNavigationAnchor;
    state.pendingNavigationAnchor = null;
    void mountPublisher(tabContent, publisherView).then(() => {
      if (!anchor) return;
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({behavior: 'smooth', block: 'start'}));
    });
  } else if (state.activeApp === 'content' && state.activeSubTab === 'studio') {
    mountReelStudio(tabContent);
  } else if (state.activeApp === 'content' && state.activeSubTab === 'flow') {
    renderContentFlow(run);
  } else if (state.activeApp === 'content' && state.activeSubTab === 'prompts') {
    renderContentPrompts(run);
  } else if (state.activeApp === 'content') {
    renderContentPreview(run);
  } else if (state.activeApp === 'brains' && state.activeSubTab === 'summary') {
    renderBrainsSummary(run);
  } else if (state.activeApp === 'brains' && state.activeSubTab === 'radar') {
    renderBrainsRadar(run);
  } else if (state.activeApp === 'brains' && state.activeSubTab === 'analysis') {
    renderBrainsAnalysis(run);
  } else if (state.activeApp === 'brains') {
    renderBrainsTrends(run);
  } else if (state.activeSubTab === 'calendar') {
    renderScaleCalendar();
  } else if (state.activeSubTab === 'runs') {
    renderScaleRuns();
  } else {
    renderScaleAssets();
  }
};

const render = () => {
  renderPrimaryNavigation();
  renderSubTabs();
  const inStudio = state.activeApp === 'content' && state.activeSubTab === 'studio';
  document.body.classList.toggle('motion-workspace', inStudio);
  document.body.classList.toggle('publisher-workspace', state.activeApp === 'scale');
  document.querySelector('.run-sidebar').hidden = inStudio || state.activeApp === 'scale' || (state.activeApp === 'brains' && !state.brainsIntelligence.runs.length);
  subTabs.hidden = true;
  const config = appConfig[state.activeApp];
  const fallbackNavigationState = getNavigationState(state);
  const activeNavigationItem = getNavigationItem(state.activeNavigationItemId) || getNavigationItem(fallbackNavigationState.activeItem);
  const activeNavigationSection = navigationSections.find((section) => section.id === state.openNavSection);
  activeKicker.textContent = activeNavigationSection?.label || config.title;
  activeTitle.textContent = activeNavigationItem?.label || config.title;

  renderRunList();
  renderMetrics();
  renderActiveTabContent();
  if (!inStudio && state.loadWarnings.length) {
    tabContent.prepend(createElement('p', 'reel-notice error', 'Część danych archiwum jest niedostępna. Odśwież stronę, aby spróbować ponownie. Studio rolek działa niezależnie.'));
  }
};

const loadData = async () => {
  const readOptional = async (url, fallback) => {
    try { return await fetchJson(url, fallback); }
    catch { state.loadWarnings.push(url); return fallback; }
  };
  const [contentRuns, brainsRuns, calendar, assets, analysisList, brainsIntelligence] = await Promise.all([
    readOptional('/api/content-runs', []),
    readOptional('/api/brains-runs', []),
    readOptional('/api/scale-calendar', {generatedAt: null, entries: []}),
    readOptional('/api/assets', {generatedAt: null, assets: []}),
    readOptional('/api/analysis-list', []),
    readOptional('/api/genius-brains', {generatedAt: null, runs: [], candidates: [], reports: []}),
  ]);

  state.contentRuns = Array.isArray(contentRuns) ? contentRuns : [];
  state.brainsRuns = Array.isArray(brainsRuns) ? brainsRuns : [];
  state.brainsIntelligence = brainsIntelligence && Array.isArray(brainsIntelligence.runs) ? brainsIntelligence : {generatedAt: null, runs: [], candidates: [], reports: []};
  state.calendar = calendar && Array.isArray(calendar.entries) ? calendar : {generatedAt: null, entries: []};
  state.assets = assets && Array.isArray(assets.assets) ? assets : {generatedAt: null, assets: []};
  state.analysisList = Array.isArray(analysisList) ? analysisList : [];
  setSelectedDefaults();
  render();
};

document.addEventListener('genius:navigate-publisher', event => {
  if (event.detail?.path) openStudioPublication(event.detail);
  const view = event.detail?.view || 'calendar';
  const tab = {calendar: 'calendar', list: 'runs', library: 'assets', accounts: 'accounts'}[view] || 'calendar';
  const item = navigationSections.find((section) => section.id === 'scale')?.items.find((entry) => entry.tab === tab);
  state.activeApp = 'scale';
  state.activeSubTab = tab;
  state.activeNavigationItemId = item?.id || 'scale-calendar';
  state.openNavSection = 'scale';
  render();
});

document.addEventListener('genius:publisher-view-changed', event => {
  const tab = {calendar: 'calendar', list: 'runs', library: 'assets', accounts: 'accounts'}[event.detail?.view];
  if (!tab || state.activeApp !== 'scale') return;
  state.activeSubTab = tab;
  state.activeNavigationItemId = navigationSections.find((section) => section.id === 'scale')?.items.find((item) => item.tab === tab)?.id || 'scale-calendar';
  state.openNavSection = 'scale';
  renderPrimaryNavigation();
  activeKicker.textContent = 'Genius@Scale';
  activeTitle.textContent = getNavigationItem(state.activeNavigationItemId)?.label || 'Publikacje';
});

loadData().catch((error) => {
  tabContent.replaceChildren(createElement('div', 'empty-state', error instanceof Error ? error.message : String(error)));
});
