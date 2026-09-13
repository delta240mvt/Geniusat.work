import {config as loadDotenv} from 'dotenv';
import {z} from 'zod';
import {resolveContentRoot, resolveWorkspaceRoot} from './app-root.js';

loadDotenv({path: resolveContentRoot('.env')});
loadDotenv({path: resolveWorkspaceRoot('.env')});

const envSchema = z.object({
  GOOGLE_VIDEO_INTELLIGENCE_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GOOGLE_API_KEY: z.string().optional().default(''),
  GOOGLE_VIDEO_INTELLIGENCE_ACCESS_TOKEN: z.string().optional().default(''),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  FIRECRAWL_API_KEY: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export const loadEnv = (env: NodeJS.ProcessEnv = process.env): AppEnv => {
  return envSchema.parse(env);
};
