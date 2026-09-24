import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {BudgetExceededError, BudgetLedger} from './budget.js';
import {parseViralIntelligenceConfig} from './config.js';
import {ViralBrainsRepository} from './persistence.js';
import {dedupeCandidates, rankCandidates} from './scoring.js';
import {
  normalizeComments,
  normalizePostMetrics,
  normalizeSearchItems,
  SocialCrawlError,
  type SocialCrawlEnvelope,
} from './socialcrawl.js';
import type {ViralCandidate, ViralIntelligenceConfig, ViralRun} from './types.js';

export interface CrawlClient {
  searchInstagramReels(query: string, page?: number, cursor?: string): Promise<SocialCrawlEnvelope>;
  searchThreads(query: string, options?: {startDate?: string; endDate?: string; limit?: number; cursor?: string}): Promise<SocialCrawlEnvelope>;
  getInstagramComments(url: string, cursor?: string): Promise<SocialCrawlEnvelope>;
  getThreadsPost(url: string): Promise<SocialCrawlEnvelope>;
  getThreadsComments(url: string, limit?: number): Promise<SocialCrawlEnvelope>;
}

export interface ViralCrawlOptions {
  config: ViralIntelligenceConfig;
  client: CrawlClient;
  repository: ViralBrainsRepository;
  dataRoot: string;
  runId: string;
  now?: Date;
}

export interface ViralCrawlResult {
  run: ViralRun;
  candidates: ViralCandidate[];
  selectedCandidates: ViralCandidate[];
  budget: ReturnType<BudgetLedger['snapshot']>;
  errors: string[];
}

export async function runViralCrawl(options: ViralCrawlOptions): Promise<ViralCrawlResult> {
  const config = parseViralIntelligenceConfig(options.config);
  const now = options.now ?? new Date();
  const runRoot = path.join(options.dataRoot, options.runId);
  await mkdir(path.join(runRoot, 'raw'), {recursive: true});

  const repository = options.repository;
  const ledger = new BudgetLedger(config.budget.maxCredits);
  ledger.reserve('safety', config.budget.reserveCredits);
  repository.createRun({runId: options.runId, configHash: hashConfig(config)});
  repository.startRun(options.runId, now.toISOString());

  const errors: string[] = [];
  const candidates: ViralCandidate[] = [];
  const categorySpent = {discovery: 0, instagram: 0, threads: 0};
  let discoveryCallIndex = 0;

  discovery: for (const platform of ['instagram', 'threads'] as const) {
    for (const language of ['en', 'pl'] as const) {
      for (const query of config.queries[platform][language]) {
        let cursor: string | undefined;
        let page = 1;

        do {
          if (categorySpent.discovery + 1 > config.budget.discoveryCredits || ledger.remaining() < 1) {
            break;
          }

          const variant = `${platform}/${language}`;
          const rawName = `${variant.replace('/', '-')}-${++discoveryCallIndex}.json`;
          const rawPath = path.join(runRoot, 'raw', rawName);

          try {
            const response = platform === 'instagram'
              ? await callProvider({
                  ledger,
                  repository,
                  runId: options.runId,
                  variant,
                  endpoint: '/instagram/search/reels',
                  fingerprint: `${platform}:${language}:${query}:${page}:${cursor ?? ''}`,
                  estimate: 1,
                  category: 'discovery',
                  rawPath,
                  dataRoot: options.dataRoot,
                  invoke: () => options.client.searchInstagramReels(query, page, cursor),
                })
              : await callProvider({
                  ledger,
                  repository,
                  runId: options.runId,
                  variant,
                  endpoint: '/threads/search',
                  fingerprint: `${platform}:${language}:${query}:${cursor ?? ''}`,
                  estimate: 1,
                  category: 'discovery',
                  rawPath,
                  dataRoot: options.dataRoot,
                  invoke: () => options.client.searchThreads(query, {
                    startDate: dateDaysAgo(now, config.lookbackDays),
                    endDate: now.toISOString().slice(0, 10),
                    limit: 20,
                    cursor,
                  }),
                });

            categorySpent.discovery += response.creditsUsed;
            const subtopic = resolveSubtopic(query, config);
            candidates.push(
              ...normalizeSearchItems(response.body, {
                runId: options.runId,
                platform,
                language,
                subtopic,
                query,
                rawPayloadPath: relativeArtifactPath(options.dataRoot, rawPath),
              }),
            );
            cursor = response.body.pagination?.next_cursor;
            page += 1;
          } catch (error) {
            errors.push(`${platform}/${language}:${query}: ${toErrorMessage(error)}`);
            if (error instanceof BudgetExceededError) break discovery;
            cursor = undefined;
          }
        } while (cursor);
      }
    }
  }

  const ranked = rankCandidates(dedupeCandidates(candidates), now);
  for (const candidate of ranked) {
    repository.insertCandidate(candidate);
  }

  const selected = selectEnrichmentCandidates(ranked, now, config.lookbackDays);
  for (const candidate of selected) {
    repository.setCandidateEnrichmentStatus(candidate.candidateId, 'selected', null);
    if (candidate.platform === 'instagram') {
      await enrichInstagramCandidate(candidate, options, ledger, repository, categorySpent, runRoot, errors);
    } else {
      await enrichThreadsCandidate(candidate, options, ledger, repository, categorySpent, runRoot, errors);
    }
  }

  ledger.release('safety');
  const status: ViralRun['status'] = errors.length > 0
    ? ranked.length > 0 ? 'partial' : 'failed'
    : ranked.length > 0 ? 'complete' : 'failed';
  repository.finishRun(options.runId, status, new Date().toISOString(), ledger.snapshot(), errors.join('\n') || null);

  return {
    run: repository.getRun(options.runId) as ViralRun,
    candidates: ranked,
    selectedCandidates: selected,
    budget: ledger.snapshot(),
    errors,
  };
}

function selectEnrichmentCandidates(candidates: ViralCandidate[], now: Date, lookbackDays: number): ViralCandidate[] {
  const eligible = candidates.filter((candidate) => {
    if (!candidate.publishedAt) return false;
    return now.getTime() - Date.parse(candidate.publishedAt) <= lookbackDays * 86_400_000;
  });
  const groups = new Map<string, ViralCandidate[]>();

  for (const candidate of eligible) {
    const key = `${candidate.platform}/${candidate.language}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  return [...groups.values()].flatMap((group) => group.slice(0, Math.min(5, Math.max(1, Math.ceil(group.length * 0.2)))));
}

async function enrichInstagramCandidate(
  candidate: ViralCandidate,
  options: ViralCrawlOptions,
  ledger: BudgetLedger,
  repository: ViralBrainsRepository,
  categorySpent: {instagram: number; threads: number; discovery: number},
  runRoot: string,
  errors: string[],
): Promise<void> {
  const estimate = 5;
  if (categorySpent.instagram + estimate > options.config.budget.instagramCommentsCredits || ledger.remaining() < estimate) {
    return;
  }

  const rawPath = path.join(runRoot, 'raw', `comments-${safeFileName(candidate.candidateId)}.json`);
  try {
    const response = await callProvider({
      ledger,
      repository,
      runId: options.runId,
      variant: `${candidate.platform}/${candidate.language}`,
      endpoint: '/instagram/post/comments',
      fingerprint: `comments:${candidate.sourceUrl}`,
      estimate,
    category: 'instagram',
    rawPath,
    dataRoot: options.dataRoot,
    invoke: () => options.client.getInstagramComments(candidate.sourceUrl),
    });
    categorySpent.instagram += response.creditsUsed;
    for (const comment of normalizeComments(response.body)) {
      repository.insertComment({...comment, candidateId: candidate.candidateId, rawEvidencePath: relativeArtifactPath(options.dataRoot, rawPath)});
    }
    repository.setCandidateEnrichmentStatus(candidate.candidateId, 'enriched', relativeArtifactPath(options.dataRoot, rawPath));
  } catch (error) {
    errors.push(`${candidate.candidateId}: ${toErrorMessage(error)}`);
    repository.setCandidateEnrichmentStatus(candidate.candidateId, 'failed', null);
  }
}

async function enrichThreadsCandidate(
  candidate: ViralCandidate,
  options: ViralCrawlOptions,
  ledger: BudgetLedger,
  repository: ViralBrainsRepository,
  categorySpent: {instagram: number; threads: number; discovery: number},
  runRoot: string,
  errors: string[],
): Promise<void> {
  const estimate = 2;
  if (categorySpent.threads + estimate > options.config.budget.threadsEnrichmentCredits || ledger.remaining() < estimate) {
    return;
  }

  try {
    const postPath = path.join(runRoot, 'raw', `post-${safeFileName(candidate.candidateId)}.json`);
    const postResponse = await callProvider({
      ledger,
      repository,
      runId: options.runId,
      variant: `${candidate.platform}/${candidate.language}`,
      endpoint: '/threads/post',
      fingerprint: `post:${candidate.sourceUrl}`,
      estimate: 1,
      category: 'threads',
      rawPath: postPath,
      dataRoot: options.dataRoot,
      invoke: () => options.client.getThreadsPost(candidate.sourceUrl),
    });
    categorySpent.threads += postResponse.creditsUsed;
    const enrichedMetrics = normalizePostMetrics(postResponse.body);
    const metricUpdates = Object.fromEntries(Object.entries(enrichedMetrics).filter(([, value]) => value !== null && value !== undefined));
    if (Object.keys(metricUpdates).length > 0) {
      candidate.metrics = {...candidate.metrics, ...metricUpdates};
      repository.updateCandidateMetrics(candidate.candidateId, candidate.metrics);
    }

    const commentsPath = path.join(runRoot, 'raw', `comments-${safeFileName(candidate.candidateId)}.json`);
    const commentsResponse = await callProvider({
      ledger,
      repository,
      runId: options.runId,
      variant: `${candidate.platform}/${candidate.language}`,
      endpoint: '/threads/post/comments',
      fingerprint: `comments:${candidate.sourceUrl}`,
      estimate: 1,
      category: 'threads',
      rawPath: commentsPath,
      dataRoot: options.dataRoot,
      invoke: () => options.client.getThreadsComments(candidate.sourceUrl, 20),
    });
    categorySpent.threads += commentsResponse.creditsUsed;

    for (const comment of normalizeComments(commentsResponse.body)) {
      repository.insertComment({...comment, candidateId: candidate.candidateId, rawEvidencePath: relativeArtifactPath(options.dataRoot, commentsPath)});
    }
    repository.setCandidateEnrichmentStatus(candidate.candidateId, 'enriched', relativeArtifactPath(options.dataRoot, commentsPath));
  } catch (error) {
    errors.push(`${candidate.candidateId}: ${toErrorMessage(error)}`);
    repository.setCandidateEnrichmentStatus(candidate.candidateId, 'failed', null);
  }
}

export async function callProvider(options: {
  ledger: BudgetLedger;
  repository: ViralBrainsRepository;
  runId: string;
  variant: string;
  endpoint: string;
  fingerprint: string;
  estimate: number;
  category: string;
  rawPath: string;
  dataRoot: string;
  invoke: () => Promise<SocialCrawlEnvelope>;
}): Promise<{body: SocialCrawlEnvelope; creditsUsed: number}> {
  options.ledger.reserve(options.category, options.estimate);
  let chargedCredits: number | null = null;
  let callRecorded = false;
  try {
    const body = await options.invoke();
    const creditsUsed = body.credits_used ?? options.estimate;
    const affordableCredits = options.ledger.remaining() + options.estimate;
    const withinBudget = options.ledger.recordProviderCharge(options.category, creditsUsed);
    chargedCredits = creditsUsed;
    await writeJson(options.rawPath, body);
    options.repository.insertCall({
      runId: options.runId,
      variant: options.variant,
      endpoint: options.endpoint,
      requestFingerprint: options.fingerprint,
      estimatedCost: options.estimate,
      actualCredits: creditsUsed,
      status: withinBudget ? 'ok' : 'over_budget',
      requestId: body.request_id,
      rawPayloadPath: relativeArtifactPath(options.dataRoot, options.rawPath),
    });
    callRecorded = true;
    options.repository.insertArtefact({
      runId: options.runId,
      kind: 'raw-provider-payload',
      path: relativeArtifactPath(options.dataRoot, options.rawPath),
      mediaType: 'application/json',
    });
    if (!withinBudget) throw new BudgetExceededError(creditsUsed, affordableCredits);
    return {body, creditsUsed};
  } catch (error) {
    let reportedOverage: BudgetExceededError | null = null;
    if (chargedCredits === null && error instanceof SocialCrawlError) {
      const body = error.responseBody;
      const reported = body && typeof body === 'object' && 'credits_used' in body ? body.credits_used : null;
      if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) {
        const affordable = options.ledger.remaining() + options.estimate;
        const withinBudget = options.ledger.recordProviderCharge(options.category, reported);
        chargedCredits = reported;
        if (!withinBudget) reportedOverage = new BudgetExceededError(reported, affordable);
      }
    }
    if (chargedCredits === null) options.ledger.release(options.category);
    if (!callRecorded) {
      options.repository.insertCall({
        runId: options.runId,
        variant: options.variant,
        endpoint: options.endpoint,
        requestFingerprint: options.fingerprint,
        estimatedCost: options.estimate,
        actualCredits: chargedCredits ?? 0,
        status: 'failed',
        error: toErrorMessage(error),
      });
    }
    throw reportedOverage ?? error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hashConfig(config: ViralIntelligenceConfig): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

function resolveSubtopic(query: string, config: ViralIntelligenceConfig): string {
  return config.subtopics.find((subtopic) => query.toLowerCase().includes(subtopic.toLowerCase())) ?? config.subtopics[0];
}

function dateDaysAgo(now: Date, days: number): string {
  const date = new Date(now.getTime() - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function relativeArtifactPath(root: string, filePath: string): string {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
