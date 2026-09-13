import {maskSecret, redactSecretsWithValues} from '../utils/env.js';

const sensitiveQueryParams = new Set([
  'access_token',
  'token',
  'api_key',
  'key',
  'signature',
  'sig',
  'secret',
  'auth',
  'authorization',
]);

const sensitiveQueryParamTokens = [
  'token',
  'signature',
  'credential',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'authorization',
  'auth',
  'sig',
];

const redactedMarkerPattern = /^<redacted:\d+>$/;

const redactSecretValue = (value: string): string => (redactedMarkerPattern.test(value) ? value : maskSecret(value) ?? '<redacted>');

const redactEncodedPlaceholders = (value: string): string =>
  value.replace(/%3Credacted%3A(\d+)%3E/gi, '<redacted:$1>');

const isSensitiveQueryParamName = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();

  return sensitiveQueryParams.has(normalizedKey) || sensitiveQueryParamTokens.some((token) => normalizedKey.includes(token));
};

const redactUrl = (value: string): string => {
  try {
    const url = new URL(value);
    let changed = false;

    for (const [key, entryValue] of url.searchParams.entries()) {
      if (isSensitiveQueryParamName(key)) {
        url.searchParams.set(key, redactSecretValue(entryValue));
        changed = true;
      }
    }

    return changed ? redactEncodedPlaceholders(url.toString()) : value;
  } catch {
    return value;
  }
};

const redactUrlQueryParams = (value: string): string =>
  value.replace(/https?:\/\/(?:[^\s"'<>]|<redacted:\d+>)+/g, (match) => redactUrl(match));

const redactSensitiveKeys = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return redactUrlQueryParams(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveKeys(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        if (sensitiveQueryParams.has(key.toLowerCase())) {
          return [key, typeof entryValue === 'string' ? redactSecretValue(entryValue) : '<redacted>'];
        }

        return [key, redactSensitiveKeys(entryValue)];
      }),
    );
  }

  return value;
};

export const redactArtifactSecrets = (value: unknown, secrets: Array<string | undefined> = []): unknown =>
  redactSecretsWithValues(redactSensitiveKeys(value), secrets);

export const redactArtifactValue = (value: unknown): unknown => redactArtifactSecrets(value);
