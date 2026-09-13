import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config as loadDotenv} from 'dotenv';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

export const loadWorkspaceEnv = (envPath = path.join(workspaceRoot, '.env')): void => {
  loadDotenv({path: envPath});
};

export const resolveEnvSecret = (envKey: string, env: NodeJS.ProcessEnv = process.env): string | undefined => {
  const value = env[envKey]?.trim();
  return value && value.length > 0 ? value : undefined;
};

export const maskSecret = (secret: string | undefined): string | undefined => {
  if (!secret) {
    return undefined;
  }

  return `<redacted:${secret.length}>`;
};

const secretEnvValues = (env: NodeJS.ProcessEnv = process.env): string[] =>
  Object.entries(env)
    .filter(([key, value]) => /(TOKEN|SECRET|API_KEY|PASSWORD)/i.test(key) && Boolean(value?.trim()))
    .map(([, value]) => value!.trim());

export const redactSecretsWithValues = (value: unknown, secrets: Array<string | undefined>): unknown => {
  const activeSecrets = secrets.filter((secret): secret is string => Boolean(secret));

  if (typeof value === 'string') {
    return activeSecrets.reduce((current, secret) => current.split(secret).join(maskSecret(secret)!), value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsWithValues(item, activeSecrets));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, redactSecretsWithValues(entryValue, activeSecrets)]),
    );
  }

  return value;
};

export const redactSecrets = (value: unknown): unknown => redactSecretsWithValues(value, secretEnvValues());
