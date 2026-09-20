import type {ViralCandidate} from './types.js';

const SCORE_WEIGHTS = {
  engagementVelocity: 0.4,
  commentSignal: 0.25,
  relativeViews: 0.2,
  likesReposts: 0.1,
  freshnessTopicFit: 0.05,
} as const;

export function dedupeCandidates(candidates: ViralCandidate[]): ViralCandidate[] {
  const byId = new Map<string, ViralCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.platform}:${candidate.sourcePostId}`;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, candidate);
      continue;
    }

    byId.set(key, {
      ...existing,
      sourceQuery: existing.sourceQuery === candidate.sourceQuery ? existing.sourceQuery : `${existing.sourceQuery} | ${candidate.sourceQuery}`,
      mediaUrls: existing.mediaUrls.length > 0 ? existing.mediaUrls : candidate.mediaUrls,
      metrics: mergeMetrics(existing.metrics, candidate.metrics),
    });
  }

  return [...byId.values()];
}

export function rankCandidates(candidates: ViralCandidate[], now: Date): ViralCandidate[] {
  const deduped = dedupeCandidates(candidates);
  const cohorts = new Map<string, ViralCandidate[]>();

  for (const candidate of deduped) {
    const key = `${candidate.platform}:${candidate.language}:${candidate.subtopic}`;
    const cohort = cohorts.get(key) ?? [];
    cohort.push(candidate);
    cohorts.set(key, cohort);
  }

  const scored = deduped.map((candidate) => {
    const cohort = cohorts.get(`${candidate.platform}:${candidate.language}:${candidate.subtopic}`) ?? [candidate];
    const ageHours = ageInHours(candidate.publishedAt, now);
    const velocity = engagementVelocity(candidate.metrics, ageHours);
    const comments = commentSignal(candidate.metrics);
    const views = Math.log1p(candidate.metrics.views ?? 0);
    const likesReposts = Math.log1p((candidate.metrics.likes ?? 0) + (candidate.metrics.reposts ?? 0));
    const freshness = Math.exp(-ageHours / (24 * 30));

    const components = {
      engagementVelocity: percentile(velocity, cohort.map((item) => engagementVelocity(item.metrics, ageInHours(item.publishedAt, now)))),
      commentSignal: percentile(comments, cohort.map((item) => commentSignal(item.metrics))),
      relativeViews: percentile(views, cohort.map((item) => Math.log1p(item.metrics.views ?? 0))),
      likesReposts: percentile(likesReposts, cohort.map((item) => Math.log1p((item.metrics.likes ?? 0) + (item.metrics.reposts ?? 0)))),
      freshnessTopicFit: (freshness + 1) / 2,
    };

    const discovery = Object.entries(SCORE_WEIGHTS).reduce(
      (total, [key, weight]) => total + components[key as keyof typeof components] * weight * 100,
      0,
    );

    return {
      ...candidate,
      score: {
        ...candidate.score,
        discovery: roundScore(discovery),
        components,
      },
    };
  });

  return scored.sort((left, right) => {
    return (
      right.score.discovery - left.score.discovery ||
      timestamp(right.publishedAt) - timestamp(left.publishedAt) ||
      left.candidateId.localeCompare(right.candidateId)
    );
  });
}

function engagementVelocity(metrics: ViralCandidate['metrics'], ageHours: number): number {
  const engagement =
    (metrics.likes ?? 0) * 0.02 +
    (metrics.comments ?? 0) * 1 +
    (metrics.replies ?? 0) * 1 +
    (metrics.reposts ?? 0) * 1.5 +
    (metrics.shares ?? 0) * 1.5;
  return engagement / Math.pow(ageHours + 1, 1.2);
}

function commentSignal(metrics: ViralCandidate['metrics']): number {
  return (metrics.comments ?? 0) + (metrics.replies ?? 0);
}

function percentile(value: number, values: number[]): number {
  if (values.length <= 1) {
    return 0.5;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = sorted.findIndex((item) => item === value);
  return rank / (sorted.length - 1);
}

function ageInHours(publishedAt: string | null, now: Date): number {
  if (!publishedAt) {
    return 24 * 90;
  }

  return Math.max(0, (now.getTime() - Date.parse(publishedAt)) / 3_600_000);
}

function timestamp(value: string | null): number {
  return value ? Date.parse(value) : 0;
}

function roundScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

function mergeMetrics(left: ViralCandidate['metrics'], right: ViralCandidate['metrics']): ViralCandidate['metrics'] {
  return {
    views: maxNullable(left.views, right.views),
    likes: maxNullable(left.likes, right.likes),
    comments: maxNullable(left.comments, right.comments),
    replies: maxNullable(left.replies, right.replies),
    reposts: maxNullable(left.reposts, right.reposts),
    shares: maxNullable(left.shares, right.shares),
  };
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}
