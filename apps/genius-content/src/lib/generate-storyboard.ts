import type {NormalizedAnalysis, ProjectConfig, StoryboardScene} from '../types/analysis.js';

type TopicProfile = {
  id: string;
  matchers: string[];
  hook: string;
  captionLead: string;
  bullets: string[];
};

const topicProfiles: TopicProfile[] = [
  {
    id: 'chatgpt',
    matchers: ['chatgpt', 'gpt', 'openai'],
    hook: 'ChatGPT do kodu i szybkich iteracji',
    captionLead: 'Tu akcent pada na tempo pracy i pisanie kodu.',
    bullets: ['szybkie iteracje', 'kodowanie', 'OpenAI'],
  },
  {
    id: 'claude',
    matchers: ['claude', 'anthropic'],
    hook: 'Claude do stylu, narracji i kreacji',
    captionLead: 'Ten fragment ustawia Claude jako model do bardziej twórczej pracy.',
    bullets: ['pisanie', 'estetyka', 'Anthropic'],
  },
  {
    id: 'gemini',
    matchers: ['gemini', 'google ai', 'deep research'],
    hook: 'Gemini do researchu i szerokiego kontekstu',
    captionLead: 'Na końcu wchodzisz w research i zbieranie kontekstu.',
    bullets: ['research', 'szeroki kontekst', 'Google'],
  },
];

const trimToLength = (value: string, maxChars: number) => {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
};

const dedupe = (values: Array<string | undefined>, limit: number) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).slice(0, limit);

const normalizeText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const cleanResearchText = (value?: string) =>
  normalizeText(value ?? '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/^welcome to the new /i, '')
    .replace(/\s+/g, ' ')
    .trim();

const detectTopic = (text: string) => {
  const lower = text.toLowerCase();
  return topicProfiles.find((profile) => profile.matchers.some((matcher) => lower.includes(matcher)));
};

const visualContextBullets = (analysis: NormalizedAnalysis) => {
  const bullets: string[] = [];
  const attributes = analysis.faceDetections[0]?.attributes ?? [];

  if (attributes.includes('looking_at_camera')) {
    bullets.push('mówisz prosto do kamery');
  }
  if (attributes.includes('glasses')) {
    bullets.push('okulary wzmacniają ekspercki look');
  }
  if (attributes.includes('headwear')) {
    bullets.push('czapka buduje rozpoznawalny kadr');
  }

  return bullets;
};

const findMatchingResearch = (analysis: NormalizedAnalysis, text: string) => {
  const lower = text.toLowerCase();

  return (
    analysis.research.find((item) => {
      const haystack = `${item.title} ${item.snippet} ${item.domain ?? ''}`.toLowerCase();
      return topicProfiles.some(
        (profile) =>
          profile.matchers.some((matcher) => lower.includes(matcher)) &&
          profile.matchers.some((matcher) => haystack.includes(matcher)),
      );
    }) ?? analysis.research[0]
  );
};

const buildIntroScene = (analysis: NormalizedAnalysis, config: ProjectConfig): StoryboardScene => {
  const detectedModels = dedupe(
    topicProfiles
      .filter((profile) => analysis.speech.some((segment) => detectTopic(segment.text)?.id === profile.id))
      .map((profile) => profile.id === 'chatgpt' ? 'ChatGPT' : profile.id === 'claude' ? 'Claude' : 'Gemini'),
    3,
  );
  const research = analysis.research[0];

  return {
    startMs: 0,
    endMs: Math.max(analysis.speech[0]?.endMs ?? 3200, 3200),
    kicker: 'HOOK',
    hookText: trimToLength('3 modele AI, 3 różne supermoce', config.storyboard.maxHookChars),
    caption: trimToLength(
      normalizeText(analysis.speech[0]?.text ?? 'Krótka rolka porównuje modele AI pod konkretne zastosowania.'),
      config.storyboard.maxCaptionChars,
    ),
    supportingBullets: dedupe(
      [...detectedModels, ...visualContextBullets(analysis), cleanResearchText(research?.title)],
      config.storyboard.maxBullets,
    ),
    visualType: 'headline',
    layout: {preset: config.layout.preset},
    sourceRefs: dedupe(
      [analysis.speech[0]?.text, research?.title, research?.sourceUrl],
      3,
    ).map((value, index) => ({
      kind: index === 0 ? 'video' : 'research',
      value,
    })),
  };
};

export const generateStoryboard = (analysis: NormalizedAnalysis, config: ProjectConfig): StoryboardScene[] => {
  if (analysis.speech.length > 0) {
    const introScene = buildIntroScene(analysis, config);
    const topicScenes = analysis.speech.map((segment, index) => {
      const transcript = normalizeText(segment.text);
      const topic = detectTopic(transcript);
      const matchedResearch = findMatchingResearch(analysis, transcript);
      const visualLabels = analysis.labels
        .slice(0, 4)
        .map((label) => label.description)
        .filter((label) => !['hair', 'beard', 'head', 'facial hair'].includes(label));

      return {
        startMs: segment.startMs,
        endMs: Math.max(segment.endMs, segment.startMs + 1400),
        kicker:
          index === 0
            ? 'OTWARCIE'
            : topic?.id === 'chatgpt'
              ? 'KOD'
              : topic?.id === 'claude'
                ? 'KREACJA'
                : topic?.id === 'gemini'
                  ? 'RESEARCH'
                  : `SEKCJA ${index + 1}`,
        hookText: trimToLength(topic?.hook ?? transcript, config.storyboard.maxHookChars),
        caption: trimToLength(
          topic ? `${topic.captionLead} ${transcript}` : transcript,
          config.storyboard.maxCaptionChars,
        ),
        supportingBullets: dedupe(
          [
            ...(topic?.bullets ?? []),
            cleanResearchText(matchedResearch?.title),
            cleanResearchText(matchedResearch?.highlights?.[0]),
            ...visualContextBullets(analysis),
            visualLabels[0],
          ],
          config.storyboard.maxBullets,
        ),
        visualType: index % 2 === 0 ? 'headline' : 'keywords',
        layout: {
          preset: config.layout.preset,
        },
        sourceRefs: dedupe(
          [transcript, matchedResearch?.title, matchedResearch?.sourceUrl],
          3,
        ).map((value, refIndex) => ({
          kind: refIndex === 0 ? 'video' : 'research',
          value,
        })),
      } satisfies StoryboardScene;
    });

    return [introScene, ...topicScenes.slice(1)];
  }

  const research = analysis.research[0];
  const topLabels = analysis.labels.slice(0, 4).map((label) => label.description);

  return [
    {
      startMs: 0,
      endMs: Math.max(analysis.durationMs, 3000),
      kicker: 'FALLBACK',
      hookText: trimToLength(cleanResearchText(research?.title) || 'Analiza materiału', config.storyboard.maxHookChars),
      caption: trimToLength(
        cleanResearchText(research?.snippet) ||
          `W materiale wykryto ${topLabels.join(', ') || 'brak mocnych znaczników semantycznych'}.`,
        config.storyboard.maxCaptionChars,
      ),
      supportingBullets: dedupe(
        [cleanResearchText(research?.highlights?.[0]), ...topLabels, ...visualContextBullets(analysis)],
        config.storyboard.maxBullets,
      ),
      visualType: 'headline',
      layout: {preset: config.layout.preset},
      sourceRefs: dedupe([research?.title, research?.sourceUrl], 2).map((value) => ({
        kind: 'research',
        value,
      })),
    },
  ];
};
