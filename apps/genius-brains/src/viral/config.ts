import {z} from 'zod';

import type {ViralIntelligenceConfig} from './types.js';

const languages = ['en', 'pl'] as const;

const defaultQueries = {
  instagram: {
    en: ['AI agents', 'AI coding', 'AI automation', 'AI marketing', 'AI productivity'],
    pl: ['agenci AI', 'kodowanie z AI', 'automatyzacja AI', 'marketing AI', 'produktywność AI'],
  },
  threads: {
    en: ['AI agents', 'AI coding', 'AI automation', 'AI marketing', 'AI productivity'],
    pl: ['agenci AI', 'kodowanie z AI', 'automatyzacja AI', 'marketing AI', 'produktywność AI'],
  },
};

const defaultBudget = {
  maxCredits: 100,
  discoveryCredits: 30,
  instagramCommentsCredits: 50,
  threadsEnrichmentCredits: 10,
  reserveCredits: 10,
} as const;

const budgetSchema = z
  .object({
    maxCredits: z.literal(100).default(100),
    discoveryCredits: z.number().int().nonnegative().default(30),
    instagramCommentsCredits: z.number().int().nonnegative().default(50),
    threadsEnrichmentCredits: z.number().int().nonnegative().default(10),
    reserveCredits: z.number().int().nonnegative().default(10),
  })
  .superRefine((budget, context) => {
    const total =
      budget.discoveryCredits +
      budget.instagramCommentsCredits +
      budget.threadsEnrichmentCredits +
      budget.reserveCredits;

    if (total !== budget.maxCredits) {
      context.addIssue({
        code: 'custom',
        message: 'Budget buckets must sum to maxCredits.',
        path: ['maxCredits'],
      });
    }
  });

const languageQueries = z.object({
  en: z.array(z.string().trim().min(1)).min(1),
  pl: z.array(z.string().trim().min(1)).min(1),
});

const configSchema = z.object({
  niche: z.string().trim().min(1),
  subtopics: z.array(z.string().trim().min(1)).min(1),
  queries: z
    .object({
      instagram: languageQueries,
      threads: languageQueries,
    })
    .default(defaultQueries),
  lookbackDays: z.number().int().min(1).max(90).default(30),
  budget: budgetSchema.default(defaultBudget),
});

export function parseViralIntelligenceConfig(input: unknown): ViralIntelligenceConfig {
  return configSchema.parse(input) as ViralIntelligenceConfig;
}

export function defaultViralIntelligenceConfig(): ViralIntelligenceConfig {
  return parseViralIntelligenceConfig({
    niche: 'AI',
    subtopics: ['AI agents', 'AI coding', 'AI automation', 'AI marketing', 'AI productivity'],
  });
}

export function variantsForConfig(config: ViralIntelligenceConfig): Array<{
  platform: 'instagram' | 'threads';
  language: (typeof languages)[number];
  queries: string[];
}> {
  return (['instagram', 'threads'] as const).flatMap((platform) =>
    languages.map((language) => ({platform, language, queries: config.queries[platform][language]})),
  );
}
