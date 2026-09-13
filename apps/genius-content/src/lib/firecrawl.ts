import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

import Firecrawl from '@mendable/firecrawl-js';

import {resolvePublicDir, resolvePublicResearchAssetDir, resolveResearchAssetDir} from './paths.js';

export type ResearchAssetCandidate = {
  url: string;
  assetPath?: string;
  score: number;
  kind: 'logo' | 'image' | 'screenshot' | 'page-capture';
  source: 'html' | 'markdown' | 'meta' | 'screenshot';
};

export type ResearchItem = {
  topicId?: string;
  title: string;
  snippet: string;
  sourceUrl?: string;
  domain?: string;
  imageUrl?: string;
  imageAssetPath?: string;
  logoUrl?: string;
  logoAssetPath?: string;
  highlights?: string[];
  proofTextSnippets?: string[];
  markdownPath?: string;
  htmlPath?: string;
  imageCandidates?: ResearchAssetCandidate[];
  logoCandidates?: ResearchAssetCandidate[];
  screenshotCandidates?: ResearchAssetCandidate[];
  pageCaptures?: ResearchAssetCandidate[];
};

const brandKeywords = [
  'eyewear',
  'glasses',
  'optical',
  'frames',
  'sunglasses',
  'fashion',
  'openai',
  'chatgpt',
  'claude',
  'anthropic',
  'gemini',
  'google ai',
  'google deepmind',
  'ai model',
];

const markdownImageRegex = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi;
const htmlMetaImageRegex =
  /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|og:image:secure_url)["'][^>]+content=["']([^"']+)["']/gi;
const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/gi;
const htmlLinkIconRegex = /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/gi;
const htmlEntityAmpRegex = /&amp;/gi;

const cleanMarkdown = (value: string) =>
  value
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const decodeUrlEntities = (value: string) => value.replace(htmlEntityAmpRegex, '&').trim();

const scoreAssetUrl = (url: string, kind: 'image' | 'logo') => {
  const lower = url.toLowerCase();
  let score = 0;

  if (kind === 'logo') {
    if (lower.includes('logo') || lower.includes('brand') || lower.includes('wordmark')) {
      score += 5;
    }
    if (lower.includes('apple-touch-icon') || lower.includes('icon-192')) {
      score += 2;
    }
    if (lower.includes('favicon') || lower.includes('sprite')) {
      score -= 3;
    }
  }

  if (kind === 'image') {
    if (
      lower.includes('hero') ||
      lower.includes('cover') ||
      lower.includes('banner') ||
      lower.includes('feature') ||
      lower.includes('product') ||
      lower.includes('interface') ||
      lower.includes('screenshot') ||
      lower.includes('twitter') ||
      lower.includes('og:image')
    ) {
      score += 4;
    }
    if (
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('sprite') ||
      lower.includes('pixel') ||
      lower.includes('quote-open') ||
      lower.includes('region-flags') ||
      lower.includes('/flags/') ||
      lower.endsWith('/us.svg')
    ) {
      score -= 4;
    }
  }

  if (lower.endsWith('.svg')) {
    score += kind === 'logo' ? 3 : 1;
  }

  return score;
};

const resolveUrl = (candidate: string, sourceUrl: string) => {
  try {
    return new URL(decodeUrlEntities(candidate), sourceUrl).toString();
  } catch {
    return undefined;
  }
};

const pickImageUrls = (markdown: string) => {
  const urls = new Set<string>();
  for (const match of markdown.matchAll(markdownImageRegex)) {
    if (match[1]) {
      urls.add(decodeUrlEntities(match[1]));
    }
  }

  return Array.from(urls);
};

const pickHtmlAssetUrls = (html: string, sourceUrl: string, pattern: RegExp) => {
  const urls = new Set<string>();

  for (const match of html.matchAll(pattern)) {
    if (!match[1]) {
      continue;
    }

    const resolved = resolveUrl(match[1], sourceUrl);
    if (resolved) {
      urls.add(resolved);
    }
  }

  return Array.from(urls);
};

const pickHighlights = (markdown: string) => {
  const lines = markdown
    .split('\n')
    .map((line) => cleanMarkdown(line))
    .filter(Boolean);

  const candidates = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes('innovation') ||
      lower.includes('technology') ||
      lower.includes('style') ||
      lower.includes('brand') ||
      lower.includes('research') ||
      lower.includes('writing') ||
      lower.includes('coding') ||
      lower.includes('model')
    );
  });

  return candidates
    .map((line) => line.replace(/^#+\s*/, ''))
    .filter((line) => line.length >= 24)
    .slice(0, 6)
    .map((line) => line.slice(0, 140));
};

const pickProofTextSnippets = (markdown: string) =>
  markdown
    .split('\n')
    .map((line) => cleanMarkdown(line))
    .filter((line) => line.length >= 28)
    .slice(0, 8)
    .map((line) => line.slice(0, 180));

const rankCandidates = ({
  urls,
  kind,
  source,
  bonus = 0,
}: {
  urls: string[];
  kind: 'image' | 'logo';
  source: 'html' | 'markdown' | 'meta';
  bonus?: number;
}): ResearchAssetCandidate[] =>
  urls
    .map((url) => ({
      url,
      score: scoreAssetUrl(url, kind) + bonus,
      kind: kind === 'logo' ? ('logo' as const) : ('image' as const),
      source,
    }))
    .sort((left, right) => right.score - left.score);

const pickLogoCandidates = (html: string, sourceUrl: string) =>
  Array.from(
    new Map(
      [
        ...rankCandidates({
          urls: pickHtmlAssetUrls(html, sourceUrl, /<img[^>]+src=["']([^"']*logo[^"']+)["']/gi),
          kind: 'logo',
          source: 'html',
          bonus: 5,
        }),
        ...rankCandidates({
          urls: pickHtmlAssetUrls(html, sourceUrl, htmlLinkIconRegex),
          kind: 'logo',
          source: 'html',
          bonus: 2,
        }),
        ...rankCandidates({
          urls: pickHtmlAssetUrls(html, sourceUrl, htmlMetaImageRegex),
          kind: 'logo',
          source: 'meta',
        }),
        {
          url: new URL('/favicon.ico', sourceUrl).toString(),
          score: scoreAssetUrl(new URL('/favicon.ico', sourceUrl).toString(), 'logo'),
          kind: 'logo' as const,
          source: 'html' as const,
        },
      ].map((candidate) => [candidate.url, candidate]),
    ).values(),
  ).slice(0, 5);

const pickImageCandidates = ({
  markdown,
  html,
  sourceUrl,
}: {
  markdown: string;
  html: string;
  sourceUrl: string;
}) =>
  Array.from(
    new Map(
      [
        ...rankCandidates({
          urls: pickHtmlAssetUrls(html, sourceUrl, htmlMetaImageRegex),
          kind: 'image',
          source: 'meta',
          bonus: 4,
        }),
        ...rankCandidates({
          urls: pickHtmlAssetUrls(html, sourceUrl, htmlImageRegex),
          kind: 'image',
          source: 'html',
        }),
        ...rankCandidates({
          urls: pickImageUrls(markdown),
          kind: 'image',
          source: 'markdown',
        }),
      ].map((candidate) => [candidate.url, candidate]),
    ).values(),
  )
    .filter((candidate) => candidate.score > -2)
    .slice(0, 6);

const toPublicAssetPath = (absolutePath: string) => {
  const relative = path.relative(resolvePublicDir(), absolutePath).replaceAll('\\', '/');
  return relative;
};

const downloadAsset = async ({
  url,
  videoId,
  slug,
}: {
  url?: string;
  videoId: string;
  slug: string;
}) => {
  if (!url) {
    return undefined;
  }

  const outputAssetDir = resolveResearchAssetDir(videoId);
  const publicAssetDir = resolvePublicResearchAssetDir(videoId);
  await mkdir(outputAssetDir, {recursive: true});
  await mkdir(publicAssetDir, {recursive: true});

  let bytes: Buffer;
  let extensionFromUrl = '';
  let contentType = '';

  if (url.startsWith('data:')) {
    const [header, payload] = url.split(',', 2);
    if (!payload) {
      return undefined;
    }
    contentType = header.split(';')[0]?.replace('data:', '').toLowerCase() ?? '';
    bytes = Buffer.from(payload, header.includes(';base64') ? 'base64' : 'utf8');
  } else {
    const response = await fetch(url);
    if (!response.ok) {
      return undefined;
    }
    extensionFromUrl = path.extname(new URL(url).pathname);
    contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    bytes = Buffer.from(await response.arrayBuffer());
  }

  const extensionFromContentType =
    contentType.includes('svg')
      ? '.svg'
      : contentType.includes('png')
        ? '.png'
        : contentType.includes('jpeg') || contentType.includes('jpg')
          ? '.jpg'
          : contentType.includes('webp')
            ? '.webp'
            : contentType.includes('gif')
              ? '.gif'
              : '.png';

  const candidateExtension = extensionFromUrl || extensionFromContentType;
  const safeExtension = candidateExtension.length <= 5 ? candidateExtension : '.png';
  const outputTarget = path.resolve(outputAssetDir, `${slug}${safeExtension}`);
  const publicTarget = path.resolve(publicAssetDir, `${slug}${safeExtension}`);
  await writeFile(outputTarget, bytes);
  await writeFile(publicTarget, bytes);
  return toPublicAssetPath(publicTarget);
};

const writeSourceExtracts = async ({
  videoId,
  slug,
  markdown,
  html,
}: {
  videoId: string;
  slug: string;
  markdown: string;
  html: string;
}) => {
  const outputAssetDir = resolveResearchAssetDir(videoId);
  await mkdir(outputAssetDir, {recursive: true});
  const markdownPath = path.resolve(outputAssetDir, `${slug}.md`);
  const htmlPath = path.resolve(outputAssetDir, `${slug}.html`);
  await writeFile(markdownPath, markdown, 'utf8');
  await writeFile(htmlPath, html, 'utf8');
  return {
    markdownPath,
    htmlPath,
  };
};

const downloadCandidateBatch = async ({
  candidates,
  videoId,
  slugPrefix,
  kind,
}: {
  candidates: ResearchAssetCandidate[];
  videoId: string;
  slugPrefix: string;
  kind: 'logo' | 'image' | 'screenshot' | 'page-capture';
}) =>
  Promise.all(
    candidates.map(async (candidate, index) => ({
      ...candidate,
      kind,
      assetPath: await downloadAsset({
        url: candidate.url,
        videoId,
        slug: `${slugPrefix}-${index + 1}`,
      }),
    })),
  );

export const enrichWithFirecrawl = async (
  queries: string[],
  {
    enabled,
    apiKey,
    maxSources,
    videoId,
    preferredDomains = [],
    seedUrls = [],
  }: {
    enabled: boolean;
    apiKey?: string;
    maxSources: number;
    videoId: string;
    preferredDomains?: string[];
    seedUrls?: Array<{topicId: string; url: string}>;
  },
): Promise<ResearchItem[]> => {
  if (!enabled || queries.length === 0) {
    return [];
  }

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is required when Firecrawl enrichment is enabled.');
  }

  const client = new Firecrawl({apiKey});
  const normalizedQuerySpace = queries.join(' ').toLowerCase();
  const enforceBrandFilter = brandKeywords.some((keyword) => normalizedQuerySpace.includes(keyword));
  const rankedResultsFromSeeds = seedUrls.map((seed) => ({
    topicId: seed.topicId,
    title: seed.url,
    url: seed.url,
    description: 'Seed source',
  }));
  const rankedResults: Array<{
    topicId?: string;
    title?: string;
    url?: string;
    description?: string;
    markdown?: string;
  }> = [];

  for (const query of Array.from(new Set(queries)).slice(0, 12)) {
    const result = (await client.search(query, {
      limit: Math.min(maxSources, 4),
      scrapeOptions: {
        formats: ['markdown'],
      },
    })) as {
      data?: {
        web?: Array<{
          topicId?: string;
          title?: string;
          url?: string;
          description?: string;
          markdown?: string;
        }>;
      };
      web?: Array<{
        topicId?: string;
        title?: string;
        url?: string;
        description?: string;
        markdown?: string;
      }>;
    };

    rankedResults.push(...(result.data?.web ?? result.web ?? []));
  }

  rankedResults.unshift(...rankedResultsFromSeeds);

  const uniqueResults = Array.from(
    new Map(rankedResults.filter((entry) => entry.url).map((entry) => [entry.url, entry])).values(),
  )
    .filter((entry) => {
      if (!enforceBrandFilter) {
        return true;
      }

      const haystack = `${entry.title ?? ''} ${entry.description ?? ''} ${entry.markdown ?? ''}`.toLowerCase();
      return brandKeywords.some((keyword) => haystack.includes(keyword));
    })
    .sort((left, right) => {
      const leftHost = left.url ? new URL(left.url).hostname : '';
      const rightHost = right.url ? new URL(right.url).hostname : '';
      const leftPreferred = preferredDomains.some((domain) => leftHost.includes(domain));
      const rightPreferred = preferredDomains.some((domain) => rightHost.includes(domain));

      if (leftPreferred === rightPreferred) {
        return 0;
      }

      return leftPreferred ? -1 : 1;
    })
    .slice(0, maxSources);

  const enriched = await Promise.all(
    uniqueResults.map(async (entry, index) => {
      const scrape = (await client.scrape(entry.url!, {
        formats: ['markdown', 'html', 'screenshot'],
      })) as {
        markdown?: string;
        html?: string;
        screenshot?: string;
      };

      const markdown = scrape.markdown ?? entry.markdown ?? '';
      const html = scrape.html ?? '';
      const sourceUrl = entry.url!;
      const imageCandidates = pickImageCandidates({
        markdown,
        html,
        sourceUrl,
      });
      const logoCandidates = pickLogoCandidates(html, sourceUrl);
      const screenshotCandidates: ResearchAssetCandidate[] = scrape.screenshot
        ? [
            {
              url: scrape.screenshot,
              score: 10,
              kind: 'screenshot',
              source: 'screenshot',
            },
          ]
        : [];
      const pageCaptures: ResearchAssetCandidate[] = scrape.screenshot
        ? [
            {
              url: scrape.screenshot,
              score: 12,
              kind: 'page-capture',
              source: 'screenshot',
            },
          ]
        : [];

      const persistedImageCandidates = await downloadCandidateBatch({
        candidates: imageCandidates.slice(0, 5),
        videoId,
        slugPrefix: `source-${index + 1}-image`,
        kind: 'image',
      });
      const persistedLogoCandidates = await downloadCandidateBatch({
        candidates: logoCandidates.slice(0, 4),
        videoId,
        slugPrefix: `source-${index + 1}-logo`,
        kind: 'logo',
      });
      const persistedScreenshotCandidates = await downloadCandidateBatch({
        candidates: screenshotCandidates,
        videoId,
        slugPrefix: `source-${index + 1}-screenshot`,
        kind: 'screenshot',
      });
      const persistedPageCaptures = await downloadCandidateBatch({
        candidates: pageCaptures,
        videoId,
        slugPrefix: `source-${index + 1}-capture`,
        kind: 'page-capture',
      });
      const extracts = await writeSourceExtracts({
        videoId,
        slug: `source-${index + 1}`,
        markdown,
        html,
      });
      const primaryImage =
        persistedPageCaptures.find((candidate) => candidate.assetPath) ??
        persistedScreenshotCandidates.find((candidate) => candidate.assetPath) ??
        persistedImageCandidates.find((candidate) => candidate.assetPath);
      const primaryLogo = persistedLogoCandidates.find((candidate) => candidate.assetPath);

      return {
        topicId: entry.topicId,
        title: entry.title ?? 'Untitled source',
        snippet: cleanMarkdown(entry.description ?? markdown).slice(0, 280),
        sourceUrl,
        domain: new URL(sourceUrl).hostname,
        imageUrl: primaryImage?.url,
        imageAssetPath: primaryImage?.assetPath,
        logoUrl: primaryLogo?.url,
        logoAssetPath: primaryLogo?.assetPath,
        highlights: pickHighlights(markdown),
        proofTextSnippets: pickProofTextSnippets(markdown),
        markdownPath: extracts.markdownPath,
        htmlPath: extracts.htmlPath,
        imageCandidates: persistedImageCandidates,
        logoCandidates: persistedLogoCandidates,
        screenshotCandidates: persistedScreenshotCandidates,
        pageCaptures: persistedPageCaptures,
      } satisfies ResearchItem;
    }),
  );

  return enriched;
};
