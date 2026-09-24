import {z} from 'zod';

const searchSchema = z.object({
  query: z.string().trim().min(1).optional(),
  language: z.enum(['en', 'pl']).default('en'),
  datePosted: z.enum(['past_24h', 'past_week', 'past_month']).optional(),
  contentType: z.enum(['videos', 'photos', 'jobs', 'live_videos', 'documents', 'collaborative_articles']).optional(),
  fromCompanyId: z.string().regex(/^\d+$/).optional(),
  fromMemberUrn: z.string().regex(/^ACo[A-Za-z0-9_-]+$/).optional(),
  sortBy: z.enum(['relevance', 'date_posted']).optional(),
  maxPages: z.number().int().min(1).max(10).default(1),
}).superRefine((search, context) => {
  if (!search.query && !search.fromCompanyId && !search.fromMemberUrn) {
    context.addIssue({code: 'custom', message: 'A query or LinkedIn source id is required.', path: ['query']});
  }
  if (!search.query && search.sortBy === 'relevance') {
    context.addIssue({code: 'custom', message: 'Subject-only searches cannot sort by relevance.', path: ['sortBy']});
  }
});

const configSchema = z.object({
  analysisFocus: z.string().trim().min(1).max(1000),
  searches: z.array(searchSchema).min(1).max(20),
  filters: z.object({
    minLikes: z.number().int().nonnegative().optional(),
    minComments: z.number().int().nonnegative().optional(),
    anyKeywords: z.array(z.string().trim().min(1)).default([]),
    excludeKeywords: z.array(z.string().trim().min(1)).default([]),
  }).default({anyKeywords: [], excludeKeywords: []}),
  maxCommentPosts: z.number().int().min(0).max(20).default(5),
  budget: z.object({
    maxCredits: z.literal(100).default(100),
    searchCredits: z.number().int().nonnegative().default(60),
    commentsCredits: z.number().int().nonnegative().default(30),
    reserveCredits: z.number().int().nonnegative().default(10),
  }).superRefine((budget, context) => {
    if (budget.searchCredits + budget.commentsCredits + budget.reserveCredits !== budget.maxCredits) {
      context.addIssue({code: 'custom', message: 'LinkedIn budget buckets must sum to 100 credits.', path: ['maxCredits']});
    }
    if (budget.searchCredits < 5) {
      context.addIssue({code: 'custom', message: 'LinkedIn search needs at least 5 credits.', path: ['searchCredits']});
    }
  }).default({maxCredits: 100, searchCredits: 60, commentsCredits: 30, reserveCredits: 10}),
});

export type LinkedInCrawlConfig = z.infer<typeof configSchema>;
export type LinkedInSearch = LinkedInCrawlConfig['searches'][number];

export function parseLinkedInCrawlConfig(input: unknown): LinkedInCrawlConfig {
  return configSchema.parse(input);
}
