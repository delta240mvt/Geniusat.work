import type {NormalizedAnalysis, StoryboardScene} from '../types/analysis.js';
import type {
  AssetAnalysis,
  ChoreographyDocument,
  ChoreographyScene,
  EvidencePlan,
  EvidenceNeed,
  EvidenceShot,
  ResearchPlan,
  TranscriptBrief,
  TranscriptTopic,
} from '../types/choreography.js';
import type {ResearchAssetCandidate, ResearchItem} from './firecrawl.js';

const topicProfiles = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    matchers: ['chatgpt', 'gpt', 'openai'],
    emphasis: 'kod i szybkie iteracje',
    shortHook: 'ChatGPT = kod',
    shortCaption: 'Szybki start. Dobry do robienia rzeczy.',
    topBullets: ['pisze kod', 'robi szybkie drafty'],
    palette: {primary: '#ff8757', secondary: '#ffd173', panel: 'rgba(255, 132, 89, 0.18)'},
    motion: {headline: 'lift', asset: 'float', captions: 'word-by-word'} as const,
  },
  {
    id: 'claude',
    label: 'Claude',
    matchers: ['claude', 'anthropic'],
    emphasis: 'styl, narracja i kreacja',
    shortHook: 'Claude = styl',
    shortCaption: 'Brzmi lepiej. Pisze czyściej.',
    topBullets: ['ładny ton', 'mocne pisanie'],
    palette: {primary: '#f0b46d', secondary: '#fff0ce', panel: 'rgba(240, 180, 109, 0.18)'},
    motion: {headline: 'slide', asset: 'stack', captions: 'word-by-word'} as const,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    matchers: ['gemini', 'google ai', 'research'],
    emphasis: 'research i szeroki kontekst',
    shortHook: 'Gemini = research',
    shortCaption: 'Szuka szeroko. Daje więcej faktów.',
    topBullets: ['dużo źródeł', 'mocny research'],
    palette: {primary: '#62c6ff', secondary: '#caefff', panel: 'rgba(98, 198, 255, 0.18)'},
    motion: {headline: 'pulse', asset: 'spotlight', captions: 'word-by-word'} as const,
  },
];

const referenceStyleSources = [
  'market_research/reel-dwynhomdbvt-remotion-style.md',
  'market_research/reel-dwynhomdbvt-scene-map.json',
];

const bannedEvidencePatterns = [
  /^https?:\/\//i,
  /^www\./i,
  /^#+\s*/,
  /picture-in-picture/i,
  /fullscreen/i,
  /submission has been received/i,
  /something went wrong/i,
  /vimeo owner on vimeo/i,
  /follow openai/i,
  /copyright/i,
  /cookie/i,
];

const normalizeText = (value: string) =>
  value
    .normalize('NFKC')
    .replaceAll('r�nicach', 'różnicach')
    .replaceAll('mi�dzy', 'między')
    .replaceAll('wypu�ci�', 'wypuścił')
    .replaceAll('�wietny', 'świetny')
    .replaceAll('troszk�', 'troszkę')
    .replaceAll('ko�cu', 'końcu')
    .replace(/\s+/g, ' ')
    .trim();

const cleanEvidenceText = (value?: string) => {
  const cleaned = normalizeText(value ?? '')
    .replace(/^#+\s*/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\[[^\]]+]\(([^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  if (bannedEvidencePatterns.some((pattern) => pattern.test(cleaned))) {
    return '';
  }

  return cleaned.length > 132 ? `${cleaned.slice(0, 129).trimEnd()}...` : cleaned;
};

const sanitizeResearchText = (value?: string) => cleanEvidenceText(value);

const dedupe = (values: Array<string | undefined>, limit: number) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).slice(0, limit);

const firstAssetPath = (...values: Array<string | undefined>) => values.find((value) => Boolean(value?.trim()));

const extractKeywords = (text: string) =>
  Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^\p{L}\p{N}-]+/gu, ''))
        .filter((word) => word.length >= 4),
    ),
  ).slice(0, 5);

const detectTopicProfile = (text: string) => {
  const lower = text.toLowerCase();
  return topicProfiles.find((profile) => profile.matchers.some((matcher) => lower.includes(matcher)));
};

const faceSignals = (analysis: NormalizedAnalysis) => analysis.faceDetections[0]?.attributes ?? [];

const toSceneTitle = (asset?: ResearchItem, fallback?: string) => {
  const cleanedTitle = cleanEvidenceText(asset?.title);
  if (cleanedTitle && !/^https?:\/\//i.test(cleanedTitle)) {
    return cleanedTitle;
  }

  return fallback ?? cleanedTitle ?? '';
};

const candidateWeight = (candidate: ResearchAssetCandidate, preferredKinds: ResearchAssetCandidate['kind'][]) => {
  let score = candidate.score;
  const lower = candidate.url.toLowerCase();

  if (candidate.assetPath) {
    score += 4;
  }
  if (preferredKinds.includes(candidate.kind)) {
    score += 12;
  }
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
    score += 3;
  }
  if (lower.endsWith('.gif')) {
    score += 1;
  }
  if (lower.endsWith('.svg')) {
    score += candidate.kind === 'logo' ? 3 : 1;
  }
  if (lower.includes('screenshot') || lower.includes('capture')) {
    score += 2;
  }
  if (lower.includes('favicon') || lower.includes('apple-touch-icon')) {
    score -= 8;
  }

  return score;
};

const pickAssetCandidate = ({
  candidates,
  preferredKinds,
  exclude = [],
}: {
  candidates: ResearchAssetCandidate[];
  preferredKinds: ResearchAssetCandidate['kind'][];
  exclude?: string[];
}) =>
  candidates
    .filter((candidate) => candidate.assetPath && !exclude.includes(candidate.assetPath))
    .sort((left, right) => candidateWeight(right, preferredKinds) - candidateWeight(left, preferredKinds))[0];

const collectRenderableCandidates = (asset?: ResearchItem) =>
  [
    ...(asset?.pageCaptures ?? []),
    ...(asset?.screenshotCandidates ?? []),
    ...(asset?.imageCandidates ?? []),
    ...(asset?.logoCandidates ?? []),
  ].filter((candidate): candidate is ResearchAssetCandidate & {assetPath: string} => Boolean(candidate.assetPath));

const pickProofBullets = ({
  asset,
  topic,
  transcriptText,
  limit,
}: {
  asset?: ResearchItem;
  topic: TranscriptTopic;
  transcriptText: string;
  limit: number;
}) => {
  const topicKeywords = [topic.label.toLowerCase(), ...topic.keywords];
  const cleanedSource = dedupe(
    [
      ...(asset?.proofTextSnippets ?? []),
      ...(asset?.highlights ?? []),
      asset?.snippet,
      asset?.title,
    ].map((value) => cleanEvidenceText(value)),
    16,
  );

  const ranked = cleanedSource
    .map((value) => {
      const lower = value.toLowerCase();
      let score = value.length >= 42 && value.length <= 96 ? 8 : 2;
      if (topicKeywords.some((keyword) => lower.includes(keyword))) {
        score += 6;
      }
      if (/(code|coding|developer|product|write|writing|research|search|report|style|voice)/i.test(value)) {
        score += 4;
      }
      if (value.split(' ').length <= 4) {
        score -= 2;
      }
      return {value, score};
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.value);

  return dedupe([...ranked, cleanEvidenceText(transcriptText)], limit);
};

const buildAssetPack = (asset?: ResearchItem) => {
  const renderable = collectRenderableCandidates(asset);
  const heroCandidate = pickAssetCandidate({
    candidates: renderable,
    preferredKinds: ['page-capture', 'screenshot'],
  });
  const detailCandidate = pickAssetCandidate({
    candidates: renderable,
    preferredKinds: ['image', 'screenshot'],
    exclude: heroCandidate?.assetPath ? [heroCandidate.assetPath] : [],
  });
  const proofCandidate = pickAssetCandidate({
    candidates: renderable,
    preferredKinds: ['image', 'page-capture', 'screenshot'],
    exclude: dedupe([heroCandidate?.assetPath, detailCandidate?.assetPath], 2),
  });
  const explicitLogoCandidate = pickAssetCandidate({
    candidates: (asset?.logoCandidates ?? []).filter((candidate): candidate is ResearchAssetCandidate & {assetPath: string} => Boolean(candidate.assetPath)),
    preferredKinds: ['logo'],
  });
  const wordmarkFallback = pickAssetCandidate({
    candidates: (asset?.imageCandidates ?? []).filter(
      (candidate): candidate is ResearchAssetCandidate & {assetPath: string} =>
        Boolean(candidate.assetPath) && /(logo|wordmark|brand)/i.test(candidate.url),
    ),
    preferredKinds: ['image'],
  });

  return {
    heroAssetPath: firstAssetPath(heroCandidate?.assetPath, asset?.imageAssetPath),
    detailAssetPath: firstAssetPath(detailCandidate?.assetPath, asset?.imageAssetPath, heroCandidate?.assetPath),
    proofAssetPath: firstAssetPath(
      proofCandidate?.assetPath,
      detailCandidate?.assetPath,
      heroCandidate?.assetPath,
      asset?.imageAssetPath,
    ),
    logoAssetPath: firstAssetPath(explicitLogoCandidate?.assetPath, wordmarkFallback?.assetPath, asset?.logoAssetPath),
  };
};

const detectStoryAngle = (topic: TranscriptTopic) => {
  if (topic.id === 'chatgpt') {
    return {
      proofTitle: 'Szybkie iteracje',
      closerTitle: 'Kod bez tarcia',
      comparisonLabel: 'kod',
    };
  }
  if (topic.id === 'claude') {
    return {
      proofTitle: 'Lepszy styl',
      closerTitle: 'Tekst z feelingiem',
      comparisonLabel: 'styl',
    };
  }
  if (topic.id === 'gemini') {
    return {
      proofTitle: 'Więcej kontekstu',
      closerTitle: 'Research board',
      comparisonLabel: 'research',
    };
  }

  return {
    proofTitle: 'Wybierz rolę',
    closerTitle: '3 różne mocne strony',
    comparisonLabel: 'porównanie',
  };
};

const detectTopTemplate = (topicId: string): ChoreographyScene['topTemplate'] => {
  if (topicId === 'intro') {
    return 'comparison-opener';
  }
  if (topicId === 'chatgpt') {
    return 'command-board';
  }
  if (topicId === 'claude') {
    return 'editorial-spotlight';
  }
  return 'research-board';
};

const buildGoogleSignals = (analysis: NormalizedAnalysis) => ({
  labels: analysis.labels.slice(0, 3).map((label) => label.description),
  objects: analysis.objects.slice(0, 3).map((object) => object.name),
  faceAttributes: faceSignals(analysis).slice(0, 4),
});

const createShot = (
  sceneId: string,
  index: number,
  startMs: number,
  endMs: number,
  partial: Omit<EvidenceShot, 'id' | 'startMs' | 'endMs'>,
): EvidenceShot => ({
  id: `${sceneId}-shot-${index + 1}`,
  startMs,
  endMs,
  ...partial,
});

const splitRange = (startMs: number, endMs: number, parts: number) => {
  const duration = Math.max(900, endMs - startMs);
  const step = duration / parts;
  return Array.from({length: parts}, (_, index) => ({
    startMs: Math.round(startMs + step * index),
    endMs: Math.round(index === parts - 1 ? endMs : startMs + step * (index + 1)),
  }));
};

const buildSceneBullets = (
  topic: TranscriptTopic,
  asset: ResearchItem | undefined,
  analysis: NormalizedAnalysis,
) =>
  dedupe(
    [
      topicProfiles.find((item) => item.id === topic.id)?.topBullets?.[0] ?? topic.emphasis,
      topicProfiles.find((item) => item.id === topic.id)?.topBullets?.[1],
      cleanEvidenceText(asset?.proofTextSnippets?.[0] ?? asset?.highlights?.[0]),
      faceSignals(analysis).includes('looking_at_camera') ? 'mówisz prosto do kamery' : undefined,
    ],
    2,
  );

const buildIntroShots = ({
  sceneId,
  startMs,
  endMs,
  comparisonScenes,
}: {
  sceneId: string;
  startMs: number;
  endMs: number;
  comparisonScenes: Array<{label: string; hookText: string; caption: string; assetPath?: string; logoAssetPath?: string}>;
}) => {
  const ranges = splitRange(startMs, endMs, 2);
  const labels = comparisonScenes.map((scene) => `${scene.label} = ${scene.caption.split('.')[0]}`);

  return [
    createShot(sceneId, 0, ranges[0].startMs, ranges[0].endMs, {
      type: 'comparison-card',
      motion: 'stack-swap',
      title: '3 modele. 3 role.',
      bullets: labels,
      referenceReason: 'Reference reel uses chapter resets and quick proof cards before deeper evidence.',
    }),
    createShot(sceneId, 1, ranges[1].startMs, ranges[1].endMs, {
      type: 'proof-card',
      motion: 'slide-left',
      title: 'Szybki wybór',
      body: 'Nie szukasz jednego zwycięzcy. Szukasz dobrego narzędzia do pracy.',
      bullets: comparisonScenes.map((scene) => scene.hookText),
      assetPath: firstAssetPath(
        comparisonScenes[0]?.assetPath,
        comparisonScenes[1]?.assetPath,
        comparisonScenes[2]?.assetPath,
      ),
      logoAssetPath: firstAssetPath(
        comparisonScenes[0]?.logoAssetPath,
        comparisonScenes[1]?.logoAssetPath,
        comparisonScenes[2]?.logoAssetPath,
      ),
      referenceReason: 'Reference reel quickly reframes the thesis before it drops into evidence shots.',
    }),
  ];
};

const buildEvidenceShots = ({
  topic,
  sceneId,
  startMs,
  endMs,
  asset,
  transcriptText,
}: {
  topic: TranscriptTopic;
  sceneId: string;
  startMs: number;
  endMs: number;
  asset?: ResearchItem;
  transcriptText: string;
}): EvidenceShot[] => {
  const ranges = splitRange(startMs, endMs, 4);
  const assetPack = buildAssetPack(asset);
  const angle = detectStoryAngle(topic);
  const proofBullets = pickProofBullets({asset, topic, transcriptText, limit: 4});

  return [
    createShot(sceneId, 0, ranges[0].startMs, ranges[0].endMs, {
      type: 'brand-card',
      motion: 'slide-up',
      title: topic.label,
      body: transcriptText,
      assetPath: assetPack.heroAssetPath,
      logoAssetPath: assetPack.logoAssetPath,
      bullets: dedupe([asset?.domain, cleanEvidenceText(asset?.snippet)], 2),
      referenceReason: 'Reference style opens a proof block with a real surface, not fake chrome.',
    }),
    createShot(sceneId, 1, ranges[1].startMs, ranges[1].endMs, {
      type: 'image-focus',
      motion: 'crop-pan',
      title: toSceneTitle(asset, topic.label),
      assetPath: assetPack.detailAssetPath ?? assetPack.heroAssetPath,
      logoAssetPath: assetPack.logoAssetPath,
      body: cleanEvidenceText(asset?.highlights?.[0]),
      crop:
        topic.id === 'chatgpt'
          ? {x: 0.08, y: 0.06, width: 0.84, height: 0.62, zoomFrom: 1, zoomTo: 1.09}
          : topic.id === 'claude'
            ? {x: 0.08, y: 0.1, width: 0.84, height: 0.58, zoomFrom: 1, zoomTo: 1.08}
            : {x: 0.06, y: 0.08, width: 0.88, height: 0.56, zoomFrom: 1, zoomTo: 1.1},
      referenceReason: 'Reference reel animates real screenshots by re-cropping them instead of drawing fake UI.',
    }),
    createShot(sceneId, 2, ranges[2].startMs, ranges[2].endMs, {
      type: 'proof-card',
      motion: topic.id === 'claude' ? 'stack-swap' : 'push-in',
      title: angle.proofTitle,
      bullets: proofBullets.slice(0, 3),
      logoAssetPath: assetPack.logoAssetPath,
      assetPath: assetPack.proofAssetPath,
      referenceReason: 'Reference reel turns spoken claims into short proof cards with real evidence nearby.',
    }),
    createShot(sceneId, 3, ranges[3].startMs, ranges[3].endMs, {
      type: 'chapter-card',
      motion: 'hard-cut',
      title: angle.closerTitle,
      body: cleanEvidenceText(asset?.highlights?.[1] ?? asset?.snippet) || transcriptText,
      bullets: dedupe(
        [
          proofBullets[3],
          cleanEvidenceText(asset?.highlights?.[2]),
          `${topic.label} = ${angle.comparisonLabel}`,
        ],
        3,
      ),
      assetPath: assetPack.proofAssetPath ?? assetPack.heroAssetPath,
      logoAssetPath: assetPack.logoAssetPath,
      referenceReason: 'Reference reel closes a topic with a denser final beat before cutting away.',
    }),
  ];
};

const findAssetForTopic = (assetAnalysis: AssetAnalysis, topicId: string) =>
  assetAnalysis.items.find((item) => item.topicId === topicId)?.chosenSource;

export const analyzeTranscript = (analysis: NormalizedAnalysis): TranscriptBrief => {
  const primaryTopics: TranscriptTopic[] = analysis.speech
    .map((segment, segmentIndex) => {
      const transcriptText = normalizeText(segment.text);
      const profile = detectTopicProfile(transcriptText);
      if (!profile && segmentIndex === 0) {
        return {
          id: 'intro',
          label: 'Intro',
          emphasis: 'ustawienie porównania modeli',
          segmentIndex,
          startMs: segment.startMs,
          endMs: segment.endMs,
          transcriptText,
          keywords: extractKeywords(transcriptText),
        } satisfies TranscriptTopic;
      }

      if (!profile) {
        return null;
      }

      return {
        id: profile.id,
        label: profile.label,
        emphasis: profile.emphasis,
        segmentIndex,
        startMs: segment.startMs,
        endMs: segment.endMs,
        transcriptText,
        keywords: extractKeywords(transcriptText),
      } satisfies TranscriptTopic;
    })
    .filter((value): value is TranscriptTopic => Boolean(value));

  const pacing =
    analysis.speech.length >= 4 || analysis.speech.some((segment) => segment.words.length >= 10) ? 'fast' : 'measured';

  return {
    videoId: analysis.videoId,
    summary:
      primaryTopics.length > 0
        ? `Rolka porównuje ${primaryTopics.map((topic) => topic.label).join(', ')} i przypisuje im różne zastosowania.`
        : 'Rolka opiera się na mówionej narracji i wymaga wsparcia wizualnego na podstawie treści.',
    primaryTopics,
    spokenLanguage: 'pl',
    pacing,
  };
};

export const buildEvidencePlan = (transcriptBrief: TranscriptBrief): EvidencePlan => {
  const topics: EvidenceNeed[] = transcriptBrief.primaryTopics.map((topic) => {
    if (topic.id === 'intro') {
      return {
        topicId: topic.id,
        sceneLabel: topic.label,
        sceneIntent: topic.emphasis,
        visualStory: 'Zbuduj szybki board porównawczy trzech modeli, zanim wejdziesz w dowody z produktu.',
        requiredProof: ['comparison', 'logo'],
        desiredShotTypes: ['comparison-card', 'proof-card'],
        searchQueries: [
          'OpenAI logo official',
          'Anthropic logo official',
          'Google Gemini logo official',
        ],
        preferredDomains: ['openai.com', 'anthropic.com', 'gemini.google.com', 'google.com'],
        seedUrls: ['https://openai.com/brand/', 'https://www.anthropic.com/claude', 'https://gemini.google/about/'],
      };
    }

    if (topic.id === 'chatgpt') {
      return {
        topicId: topic.id,
        sceneLabel: topic.label,
        sceneIntent: topic.emphasis,
        visualStory: 'Pokaż realny produkt OpenAI, detail z brand page i proof cards pod szybkość, drafty i kod.',
        requiredProof: ['logo', 'product-ui', 'screenshot', 'facts'],
        desiredShotTypes: ['brand-card', 'image-focus', 'proof-card'],
        searchQueries: [
          'OpenAI ChatGPT official brand',
          'OpenAI ChatGPT interface screenshot official',
          'OpenAI ChatGPT coding product page',
          'OpenAI ChatGPT features official',
        ],
        preferredDomains: ['openai.com'],
        seedUrls: ['https://openai.com/chatgpt/', 'https://openai.com/brand/'],
      };
    }

    if (topic.id === 'claude') {
      return {
        topicId: topic.id,
        sceneLabel: topic.label,
        sceneIntent: topic.emphasis,
        visualStory: 'Pokaż stronę Claude, realny screen i proof cards pod voice, writing i polish.',
        requiredProof: ['logo', 'product-ui', 'hero-shot', 'facts'],
        desiredShotTypes: ['brand-card', 'image-focus', 'proof-card'],
        searchQueries: [
          'Anthropic Claude official logo',
          'Anthropic Claude official product page',
          'Anthropic Claude screenshot official',
          'Anthropic Claude writing features official',
        ],
        preferredDomains: ['anthropic.com'],
        seedUrls: ['https://www.anthropic.com/claude'],
      };
    }

    return {
      topicId: topic.id,
      sceneLabel: topic.label,
      sceneIntent: topic.emphasis,
      visualStory: 'Pokaż brand Gemini, research surface i proof cards pod depth, search i breadth.',
      requiredProof: ['logo', 'product-ui', 'screenshot', 'facts'],
      desiredShotTypes: ['brand-card', 'image-focus', 'proof-card'],
      searchQueries: [
        'Google Gemini official logo',
        'Google Gemini official product page',
        'Google Gemini screenshot official',
        'Google Gemini research features official',
      ],
      preferredDomains: ['gemini.google.com', 'gemini.google', 'google.com'],
      seedUrls: ['https://gemini.google/about/', 'https://gemini.google.com/'],
    };
  });

  return {
    videoId: transcriptBrief.videoId,
    createdAt: new Date().toISOString(),
    strategy: 'Najpierw ustal, jakie dowody wizualne mają być pokazane w każdej scenie. Dopiero potem buduj brief dla Firecrawl.',
    topics,
  };
};

export const buildResearchPlan = (
  analysis: NormalizedAnalysis,
  transcriptBrief: TranscriptBrief,
  evidencePlan: EvidencePlan,
): ResearchPlan => {
  const queries = new Set<string>();
  const preferredDomains = new Set<string>();
  const seedUrls: Array<{topicId: string; url: string}> = [];

  for (const topic of evidencePlan.topics) {
    topic.searchQueries.forEach((query) => queries.add(query));
    topic.preferredDomains.forEach((domain) => preferredDomains.add(domain));
    topic.seedUrls.forEach((url) => seedUrls.push({topicId: topic.topicId, url}));
  }

  if (queries.size === 0) {
    analysis.speech.slice(0, 2).forEach((segment) => queries.add(normalizeText(segment.text)));
  }

  return {
    videoId: analysis.videoId,
    queries: Array.from(queries),
    preferredDomains: Array.from(preferredDomains),
    seedUrls,
    assetGoals: evidencePlan.topics.flatMap((topic) => [
      ...(topic.requiredProof.includes('logo')
        ? [
            {
              topicId: topic.topicId,
              need: 'logo' as const,
              rationale: `Potrzebne logo dla sceny ${topic.sceneLabel}.`,
            },
          ]
        : []),
      ...(topic.requiredProof.some((need) => ['hero-shot', 'product-ui', 'screenshot'].includes(need))
        ? [
            {
              topicId: topic.topicId,
              need: 'image' as const,
              rationale: `Potrzebny screen lub hero shot wspierający temat ${topic.sceneLabel}.`,
            },
          ]
        : []),
      ...(topic.requiredProof.includes('facts')
        ? [
            {
              topicId: topic.topicId,
              need: 'knowledge' as const,
              rationale: `Potrzebne highlights i fakty dla ${topic.sceneLabel}.`,
            },
          ]
        : []),
    ]),
  };
};

const scoreResearchForTopic = (topic: TranscriptTopic, item?: ResearchItem) => {
  if (!item) {
    return {score: 0, reasons: ['brak źródła']};
  }

  const haystack = `${item.title} ${item.snippet} ${item.domain ?? ''}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (haystack.includes(topic.label.toLowerCase())) {
    score += 4;
    reasons.push('tytuł lub opis pasuje do tematu');
  }
  if (topic.id === 'chatgpt' && haystack.includes('openai')) {
    score += 4;
    reasons.push('oficjalne OpenAI');
  }
  if (topic.id === 'claude' && haystack.includes('anthropic')) {
    score += 4;
    reasons.push('oficjalne Anthropic');
  }
  if (topic.id === 'gemini' && (haystack.includes('google') || haystack.includes('gemini'))) {
    score += 4;
    reasons.push('oficjalne Google/Gemini');
  }
  if (item.logoAssetPath) {
    score += 3;
    reasons.push('ma lokalne logo');
  }
  if (item.imageAssetPath) {
    score += 2;
    reasons.push('ma lokalny obraz');
  }
  if (item.logoCandidates?.some((candidate) => candidate.assetPath)) {
    score += 3;
    reasons.push('ma wiele kandydatów logo');
  }
  if (item.imageCandidates?.some((candidate) => candidate.assetPath)) {
    score += 4;
    reasons.push('ma wiele kandydatów image');
  }
  if (item.screenshotCandidates?.some((candidate) => candidate.assetPath)) {
    score += 5;
    reasons.push('ma screenshot strony');
  }
  if (item.pageCaptures?.some((candidate) => candidate.assetPath)) {
    score += 6;
    reasons.push('ma page capture do cropów');
  }
  if (item.highlights?.length) {
    score += 1;
    reasons.push('ma highlights do copy');
  }
  if (item.proofTextSnippets?.length) {
    score += 2;
    reasons.push('ma proof snippets');
  }
  if (item.topicId === topic.id) {
    score += 20;
    reasons.push('seed przypięty do tego tematu');
  }

  return {score, reasons};
};

export const analyzeAssets = (
  transcriptBrief: TranscriptBrief,
  research: ResearchItem[],
): AssetAnalysis => ({
  videoId: transcriptBrief.videoId,
  evaluatedAt: new Date().toISOString(),
  items: transcriptBrief.primaryTopics.map((topic) => {
    const ranked = research
      .map((item) => ({item, ...scoreResearchForTopic(topic, item)}))
      .sort((left, right) => right.score - left.score)[0];

    return {
      topicId: topic.id,
      chosenSource: ranked?.item,
      score: ranked?.score ?? 0,
      reasons: ranked?.reasons ?? ['brak dopasowanego assetu'],
    };
  }),
});

export const buildChoreography = ({
  analysis,
  transcriptBrief,
  assetAnalysis,
}: {
  analysis: NormalizedAnalysis;
  transcriptBrief: TranscriptBrief;
  assetAnalysis: AssetAnalysis;
}): ChoreographyDocument => {
  const scenes: ChoreographyScene[] = transcriptBrief.primaryTopics.map((topic, index) => {
    const profile =
      topic.id === 'intro'
        ? {
            palette: {primary: '#f59f68', secondary: '#f7eadb', panel: 'rgba(245, 159, 104, 0.18)'},
            motion: {headline: 'lift', asset: 'float', captions: 'word-by-word'} as const,
          }
        : (topicProfiles.find((item) => item.id === topic.id) ?? topicProfiles[0]);
    const segment = analysis.speech[topic.segmentIndex];
    const asset = findAssetForTopic(assetAnalysis, topic.id);
    const googleSignals = buildGoogleSignals(analysis);
    const assetPack = buildAssetPack(asset);
    const baseCaption =
      topic.id === 'intro'
        ? 'Każdy model robi co innego.'
        : (topicProfiles.find((item) => item.id === topic.id)?.shortCaption ?? topic.transcriptText);

    return {
      id: `${analysis.videoId}-${topic.id}`,
      startMs: topic.startMs,
      endMs: Math.max(topic.endMs, topic.startMs + 1400),
      topTemplate: detectTopTemplate(topic.id),
      kicker: topic.id === 'intro' ? 'START' : topic.label.toUpperCase(),
      hookText:
        topic.id === 'intro'
          ? 'Który AI wygrywa?'
          : (topicProfiles.find((item) => item.id === topic.id)?.shortHook ?? `${topic.label}: ${topic.emphasis}`),
      caption: baseCaption,
      supportingBullets: buildSceneBullets(topic, asset, analysis),
      transcriptText: topic.transcriptText,
      transcriptWords: segment?.words ?? [],
      palette: profile.palette,
      motion: profile.motion,
      asset: topic.id !== 'intro' && asset
        ? {
            title: toSceneTitle(asset, topic.label),
            sourceUrl: asset.sourceUrl,
            domain: asset.domain,
            imageAssetPath: assetPack.heroAssetPath,
            logoAssetPath: assetPack.logoAssetPath,
            highlights: asset.highlights,
            proofTextSnippets: asset.proofTextSnippets,
            markdownPath: asset.markdownPath,
            htmlPath: asset.htmlPath,
            imageCandidates: asset.imageCandidates,
            logoCandidates: asset.logoCandidates,
            screenshotCandidates: asset.screenshotCandidates,
            pageCaptures: asset.pageCaptures,
          }
        : undefined,
      googleSignals: {
        labels: googleSignals.labels,
        objects: googleSignals.objects,
        faceAttributes:
          index === 0
            ? ['looking_at_camera', ...googleSignals.faceAttributes]
            : googleSignals.faceAttributes,
      },
      bottomLayer: topic.id === 'intro'
        ? []
        : buildEvidenceShots({
            topic,
            sceneId: `${analysis.videoId}-${topic.id}`,
            startMs: topic.startMs,
            endMs: Math.max(topic.endMs, topic.startMs + 1400),
            asset,
            transcriptText: topic.transcriptText,
          }),
    };
  });

  const comparisonScenes = scenes.filter((scene) => scene.id !== `${analysis.videoId}-intro`).slice(0, 3);
  const introScene = scenes.find((scene) => scene.id === `${analysis.videoId}-intro`);
  if (introScene) {
    introScene.supportingBullets = ['kod vs styl vs research', 'nie wszystko robi to samo'];
    introScene.bottomLayer = buildIntroShots({
      sceneId: introScene.id,
      startMs: introScene.startMs,
      endMs: introScene.endMs,
      comparisonScenes: comparisonScenes.map((scene) => ({
        label: scene.kicker,
        hookText: scene.hookText,
        caption: scene.caption,
        assetPath: scene.asset?.imageAssetPath,
        logoAssetPath: scene.asset?.logoAssetPath,
      })),
    });
  }

  return {
    videoId: analysis.videoId,
    createdAt: new Date().toISOString(),
    strategy:
      'Transkrypcja prowadzi narrację. Firecrawl dostarcza materiały, a analiza obrazu pomaga zsynchronizować sceny. Hyperframes łączy je z animacjami i napisami.',
    transcriptSummary: transcriptBrief.summary,
    referenceStyleSources,
    scenes,
  };
};

export const buildSceneDesign = ({
  analysis,
  transcriptBrief,
  evidencePlan,
  assetAnalysis,
  choreography,
}: {
  analysis: NormalizedAnalysis;
  transcriptBrief: TranscriptBrief;
  evidencePlan: EvidencePlan;
  assetAnalysis: AssetAnalysis;
  choreography: ChoreographyDocument;
}) => ({
  videoId: analysis.videoId,
  createdAt: new Date().toISOString(),
  strategy: {
    narrativeLead: 'clean transcript',
    visualSupport: ['firecrawl evidence packs', 'google visual analysis', 'market research'],
    topRule: 'top enriches the spoken line instead of repeating it',
    captionRule: 'center stays word-by-word from transcript timings',
    evidenceRule: 'each scene needs multiple evidence beats in bottomLayer[] before render',
  },
  scenes: transcriptBrief.primaryTopics.map((topic) => {
    const scene = choreography.scenes.find((candidate) => candidate.id === `${analysis.videoId}-${topic.id}`);
    const evidence = evidencePlan.topics.find((candidate) => candidate.topicId === topic.id);
    const asset = findAssetForTopic(assetAnalysis, topic.id);
    return {
      topicId: topic.id,
      label: topic.label,
      timing: {
        startMs: topic.startMs,
        endMs: topic.endMs,
      },
      transcriptIntent: topic.emphasis,
      visualFocus: evidence?.visualStory ?? topic.transcriptText,
      topTemplate: scene?.topTemplate,
      chosenAsset: asset && topic.id !== 'intro'
        ? {
            title: toSceneTitle(asset, topic.label),
            sourceUrl: asset.sourceUrl,
            logoAssetPath: buildAssetPack(asset).logoAssetPath,
            imageAssetPath: buildAssetPack(asset).heroAssetPath,
            logoCandidates: asset.logoCandidates?.length ?? 0,
            imageCandidates: asset.imageCandidates?.length ?? 0,
            screenshotCandidates: asset.screenshotCandidates?.length ?? 0,
            pageCaptures: asset.pageCaptures?.length ?? 0,
            proofTextSnippets: asset.proofTextSnippets?.length ?? 0,
            markdownPath: asset.markdownPath,
            htmlPath: asset.htmlPath,
          }
        : undefined,
      googleSignals: {
        labels: analysis.labels.slice(0, 4).map((label) => label.description),
        objects: analysis.objects.slice(0, 4).map((object) => object.name),
        faceAttributes: dedupe(['looking_at_camera', ...faceSignals(analysis)], 6),
      },
      desiredShotTypes: evidence?.desiredShotTypes ?? [],
      plannedBottomLayer: scene?.bottomLayer.map((shot) => ({
        type: shot.type,
        motion: shot.motion,
        title: shot.title,
        assetPath: shot.assetPath,
      })),
    };
  }),
});

export const buildVideoDirection = ({
  analysis,
  choreography,
  sceneDesign,
}: {
  analysis: NormalizedAnalysis;
  choreography: ChoreographyDocument;
  sceneDesign: ReturnType<typeof buildSceneDesign>;
}) => ({
  videoId: analysis.videoId,
  createdAt: new Date().toISOString(),
  referenceStyleSources,
  principles: [
    'Drive all motion with a deterministic GSAP timeline registered for Hyperframes.',
    'Reference local assets by relative URLs inside the prepared project.',
    'Keep clip start times and durations aligned with the video timeline.',
    'Prefer real screenshots, logos, and crops over generic motion graphics.',
    'Keep center transcript word-by-word and use top copy only as enrichment.',
  ],
  sceneEvidencePlan: choreography.scenes.map((scene) => ({
    sceneId: scene.id,
    hookText: scene.hookText,
    bottomLayer: scene.bottomLayer,
    assetPack: scene.asset
      ? {
          logoCandidates: scene.asset.logoCandidates?.length ?? 0,
          imageCandidates: scene.asset.imageCandidates?.length ?? 0,
          screenshotCandidates: scene.asset.screenshotCandidates?.length ?? 0,
          pageCaptures: scene.asset.pageCaptures?.length ?? 0,
          proofTextSnippets: scene.asset.proofTextSnippets?.length ?? 0,
        }
      : undefined,
  })),
  sourceSceneDesign: sceneDesign,
});

export const choreographyToStoryboard = (choreography: ChoreographyDocument): StoryboardScene[] =>
  choreography.scenes.map((scene) => ({
    startMs: scene.startMs,
    endMs: scene.endMs,
    kicker: scene.kicker,
    hookText: scene.hookText,
    caption: scene.caption,
    supportingBullets: scene.supportingBullets,
    visualType:
      scene.bottomLayer[0]?.type === 'comparison-card'
        ? 'timeline'
        : scene.motion.asset === 'spotlight'
          ? 'stat'
          : 'headline',
    layout: {preset: 'split-50-50'},
    sourceRefs: dedupe([scene.transcriptText, scene.asset?.title, scene.asset?.sourceUrl], 3).map((value, index) => ({
      kind: index === 0 ? 'video' : 'research',
      value,
    })),
  }));
