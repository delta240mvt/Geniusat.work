import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

import {GoogleAuth} from 'google-auth-library';
import {resolveFromWorkspaceOrAbsolute} from './app-root.js';

const execFileAsync = promisify(execFile);

export type GoogleVideoFeature =
  | 'LABEL_DETECTION'
  | 'SHOT_CHANGE_DETECTION'
  | 'TEXT_DETECTION'
  | 'SPEECH_TRANSCRIPTION'
  | 'OBJECT_TRACKING'
  | 'FACE_DETECTION';

export type AnnotateRequestInput = {
  inputContent: string;
  features: GoogleVideoFeature[];
  locationId?: string;
  speechTranscriptionConfig?: {
    languageCode: string;
    enableAutomaticPunctuation: boolean;
    filterProfanity: boolean;
    maxAlternatives: number;
  };
  faceDetectionConfig?: {
    includeBoundingBoxes: boolean;
    includeAttributes: boolean;
  };
};

const GOOGLE_ANNOTATE_URL = 'https://videointelligence.googleapis.com/v1/videos:annotate';
const GOOGLE_OPERATIONS_BASE = 'https://videointelligence.googleapis.com/v1';

export const buildVideoAnnotationRequest = ({
  inputContent,
  features,
  locationId,
  speechTranscriptionConfig,
  faceDetectionConfig,
}: AnnotateRequestInput) => {
  return {
    inputContent,
    features,
    locationId,
    videoContext: {
      ...(features.includes('SPEECH_TRANSCRIPTION') && speechTranscriptionConfig
        ? {
            speechTranscriptionConfig,
          }
        : {}),
      ...(features.includes('FACE_DETECTION') && faceDetectionConfig
        ? {
            faceDetectionConfig,
          }
        : {}),
    },
  };
};

export const toBase64Video = async (inputPath: string) => {
  const buffer = await readFile(inputPath);
  return buffer.toString('base64');
};

export const getGoogleAccessToken = async (env: NodeJS.ProcessEnv = process.env) => {
  if (env.GOOGLE_VIDEO_INTELLIGENCE_ACCESS_TOKEN) {
    return env.GOOGLE_VIDEO_INTELLIGENCE_ACCESS_TOKEN;
  }

  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const auth = new GoogleAuth({
      keyFile: resolveFromWorkspaceOrAbsolute(env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error('Could not mint an access token from GOOGLE_SERVICE_ACCOUNT_JSON.');
    }

    return tokenResponse.token;
  }

  try {
    const {stdout} = await execFileAsync('gcloud', ['auth', 'application-default', 'print-access-token']);
    const token = stdout.trim();
    if (!token) {
      throw new Error('Empty gcloud access token.');
    }

    return token;
  } catch (error) {
    throw new Error(
      `Google Video Intelligence requires OAuth or ADC. The provided API key alone is not sufficient for videos:annotate. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export const annotateVideo = async ({
  inputPath,
  features,
  locationId,
  speechTranscriptionConfig,
  faceDetectionConfig,
  env = process.env,
}: {
  inputPath: string;
  features: GoogleVideoFeature[];
  locationId?: string;
  speechTranscriptionConfig?: AnnotateRequestInput['speechTranscriptionConfig'];
  faceDetectionConfig?: AnnotateRequestInput['faceDetectionConfig'];
  env?: NodeJS.ProcessEnv;
}) => {
  const accessToken = await getGoogleAccessToken(env);
  const inputContent = await toBase64Video(inputPath);
  const requestBody = buildVideoAnnotationRequest({
    inputContent,
    features,
    locationId,
    speechTranscriptionConfig,
    faceDetectionConfig,
  });

  const response = await fetch(GOOGLE_ANNOTATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google annotate request failed: ${response.status} ${body}`);
  }

  const operation = (await response.json()) as {name?: string; done?: boolean; response?: unknown; error?: unknown};
  if (!operation.name) {
    throw new Error('Google annotate response did not include an operation name.');
  }

  return operation;
};

export const pollOperation = async ({
  operationName,
  env = process.env,
  timeoutMs = 10 * 60 * 1000,
  intervalMs = 5_000,
}: {
  operationName: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  intervalMs?: number;
}) => {
  const accessToken = await getGoogleAccessToken(env);
  const deadline = Date.now() + timeoutMs;
  let lastPayload: unknown = null;

  while (Date.now() < deadline) {
    const response = await fetch(`${GOOGLE_OPERATIONS_BASE}/${operationName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google operation poll failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as {done?: boolean; error?: unknown; response?: unknown};
    lastPayload = payload;

    if (payload.done) {
      if (payload.error) {
        throw new Error(`Google operation returned an error: ${JSON.stringify(payload.error)}`);
      }

      return payload.response;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Google operation timed out. Last payload: ${JSON.stringify(lastPayload)}`);
};
