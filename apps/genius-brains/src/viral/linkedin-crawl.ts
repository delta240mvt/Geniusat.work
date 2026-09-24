import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {BudgetExceededError, BudgetLedger} from './budget.js';
import {callProvider} from './crawl.js';
import {parseLinkedInCrawlConfig, type LinkedInCrawlConfig, type LinkedInSearch} from './linkedin-config.js';
import {ViralBrainsRepository} from './persistence.js';
import {dedupeCandidates, rankCandidates} from './scoring.js';
import {linkedinCommentsEndpoint, normalizeComments, normalizeSearchItems, SocialCrawlError, type SocialCrawlEnvelope} from './socialcrawl.js';
import type {ViralCandidate, ViralRun} from './types.js';

export interface LinkedInCrawlClient {
  searchLinkedInPosts(search: LinkedInSearch, page?: number, cursor?: string): Promise<SocialCrawlEnvelope>;
  getLinkedInComments(url: string): Promise<SocialCrawlEnvelope>;
}

export async function runLinkedInCrawl(options: {
  config: LinkedInCrawlConfig;
  client: LinkedInCrawlClient;
  repository: ViralBrainsRepository;
  dataRoot: string;
  runId: string;
  now?: Date;
}): Promise<{run: ViralRun; candidates: ViralCandidate[]; budget: ReturnType<BudgetLedger['snapshot']>; errors: string[]; filteredOut: number}> {
  const config = parseLinkedInCrawlConfig(options.config);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(options.runId)) throw new Error('Invalid LinkedIn run id.');
  const runRoot = path.join(options.dataRoot, options.runId);
  const ledger = new BudgetLedger(config.budget.maxCredits);
  ledger.reserve('safety', config.budget.reserveCredits);
  options.repository.createRun({runId: options.runId, configHash: createHash('sha256').update(JSON.stringify(config)).digest('hex')});
  options.repository.startRun(options.runId, (options.now ?? new Date()).toISOString());
  await mkdir(path.join(runRoot, 'raw'), {recursive: true});
  const criteriaPath = path.join(runRoot, 'research-criteria.json');
  await writeFile(criteriaPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  options.repository.insertArtefact({runId: options.runId, kind: 'linkedin-research-criteria', path: `${options.runId}/research-criteria.json`, mediaType: 'application/json'});

  const discovered: ViralCandidate[] = [];
  const errors: string[] = [];
  let searchSpent = 0;
  let commentSpent = 0;

  searches: for (const [searchIndex, search] of config.searches.entries()) {
    let cursor: string | undefined;
    for (let page = 1; page <= search.maxPages; page += 1) {
      const estimate = 5;
      if (searchSpent + estimate > config.budget.searchCredits || ledger.remaining() < estimate) break searches;
      const rawPath = path.join(runRoot, 'raw', `linkedin-search-${searchIndex + 1}-${page}.json`);
      const queryLabel = search.query ?? search.fromMemberUrn ?? search.fromCompanyId ?? 'source';
      try {
        const response = await callProvider({
          ledger, repository: options.repository, runId: options.runId,
          variant: `linkedin/${search.language}`, endpoint: '/linkedin/search/posts',
          fingerprint: createHash('sha256').update(JSON.stringify({search, page, cursor})).digest('hex'),
          estimate, category: 'linkedin-search', rawPath, dataRoot: options.dataRoot,
          invoke: () => options.client.searchLinkedInPosts(search, page, cursor),
        });
        searchSpent += response.creditsUsed;
        const normalized = normalizeSearchItems(response.body, {
          runId: options.runId, platform: 'linkedin', language: search.language,
          subtopic: queryLabel, query: queryLabel,
          rawPayloadPath: path.relative(options.dataRoot, rawPath).replaceAll(path.sep, '/'),
        });
        const usable = normalized.filter((candidate) => isLinkedInUrl(candidate.sourceUrl));
        const payload = response.body.data;
        const rawCount = payload && typeof payload === 'object' && 'items' in payload && Array.isArray(payload.items) ? payload.items.length : 0;
        if (rawCount > 0 && usable.length === 0) {
          errors.push(`linkedin/${search.language}:${queryLabel}: SocialCrawl returned posts without usable public LinkedIn links.`);
          break;
        }
        discovered.push(...usable.map((candidate) => ({
          ...candidate,
          candidateId: `${options.runId}:${candidate.candidateId}`,
        })));
        if (!response.body.pagination?.has_more) break;
        const nextCursor = response.body.pagination.next_cursor;
        if (nextCursor && nextCursor === cursor) break;
        cursor = nextCursor;
      } catch (error) {
        errors.push(`linkedin/${search.language}:${queryLabel}: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof BudgetExceededError || hasProviderCharge(error)) break searches;
        break;
      }
    }
  }

  const unique = dedupeCandidates(discovered);
  const matching = unique.filter((candidate) => matchesCriteria(candidate, config.filters));
  const ranked = rankCandidates(matching, options.now ?? new Date());
  for (const candidate of ranked) {
    options.repository.insertCandidate(candidate);
    options.repository.setCandidateEnrichmentStatus(candidate.candidateId, 'selected', null);
  }

  for (const candidate of ranked.slice(0, config.maxCommentPosts)) {
    const estimate = 5;
    if (commentSpent + estimate > config.budget.commentsCredits || ledger.remaining() < estimate) break;
    const spentBeforeCall = ledger.spent();
    const rawPath = path.join(runRoot, 'raw', `linkedin-comments-${createHash('sha256').update(candidate.candidateId).digest('hex').slice(0, 16)}.json`);
    try {
      const response = await callProvider({
        ledger, repository: options.repository, runId: options.runId,
        variant: `linkedin/${candidate.language}`, endpoint: linkedinCommentsEndpoint(candidate.sourceUrl),
        fingerprint: createHash('sha256').update(`comments:${candidate.sourceUrl}`).digest('hex'),
        estimate, category: 'linkedin-comments', rawPath, dataRoot: options.dataRoot,
        invoke: () => options.client.getLinkedInComments(candidate.sourceUrl),
      });
      const evidencePath = path.relative(options.dataRoot, rawPath).replaceAll(path.sep, '/');
      for (const comment of normalizeComments(response.body)) {
        options.repository.insertComment({...comment, candidateId: candidate.candidateId, rawEvidencePath: evidencePath});
      }
      options.repository.setCandidateEnrichmentStatus(candidate.candidateId, 'enriched', evidencePath);
    } catch (error) {
      errors.push(`${candidate.candidateId}: ${error instanceof Error ? error.message : String(error)}`);
      options.repository.setCandidateEnrichmentStatus(candidate.candidateId, 'failed', null);
      if (error instanceof BudgetExceededError) break;
    } finally {
      commentSpent += ledger.spent() - spentBeforeCall;
    }
  }

  ledger.release('safety');
  const status: ViralRun['status'] = errors.length ? (ranked.length ? 'partial' : 'failed') : 'complete';
  options.repository.finishRun(options.runId, status, new Date().toISOString(), ledger.snapshot(), errors.join('\n') || null);
  return {run: options.repository.getRun(options.runId) as ViralRun, candidates: ranked, budget: ledger.snapshot(), errors, filteredOut: unique.length - matching.length};
}

function matchesCriteria(candidate: ViralCandidate, filters: LinkedInCrawlConfig['filters']): boolean {
  if (filters.minLikes !== undefined && (candidate.metrics.likes ?? -1) < filters.minLikes) return false;
  if (filters.minComments !== undefined && (candidate.metrics.comments ?? -1) < filters.minComments) return false;
  const text = candidate.text?.toLocaleLowerCase() ?? '';
  if (filters.anyKeywords.length && !filters.anyKeywords.some((word) => text.includes(word.toLocaleLowerCase()))) return false;
  return !filters.excludeKeywords.some((word) => text.includes(word.toLocaleLowerCase()));
}

function isLinkedInUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'));
  } catch {
    return false;
  }
}

function hasProviderCharge(error: unknown): boolean {
  if (!(error instanceof SocialCrawlError)) return false;
  const body = error.responseBody;
  return Boolean(body && typeof body === 'object' && 'credits_used' in body && typeof body.credits_used === 'number' && body.credits_used > 0);
}
