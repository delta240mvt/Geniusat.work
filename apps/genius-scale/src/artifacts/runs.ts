import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import type {CalendarRunSummary} from '../config/schema.js';
import {writeDeterministicJson} from './json.js';
import type {ScalePaths} from './paths.js';

export interface RunArtifact {
  itemId: string;
  type: 'validation' | 'dry_run' | 'publish';
  status: 'ok' | 'blocked' | 'failed';
  createdAt: string;
  message?: string;
  validation?: unknown;
  payload?: unknown;
  payloads?: unknown[];
  response?: unknown;
  summary?: unknown;
}

interface NodeError extends Error {
  code?: string;
}

const safeRunFileName = (artifact: RunArtifact): string =>
  `${artifact.createdAt.replace(/[:.]/g, '-')}-${artifact.type}.json`;

export const writeRunArtifact = async (paths: ScalePaths, artifact: RunArtifact): Promise<string> => {
  const artifactPath = path.join(paths.getItemRunDir(artifact.itemId), safeRunFileName(artifact));
  await writeDeterministicJson(artifactPath, artifact);
  return artifactPath;
};

const runSummaryFromArtifact = (artifact: RunArtifact, artifactPath: string): CalendarRunSummary => ({
  itemId: artifact.itemId,
  type: artifact.type,
  status: artifact.status,
  ...(artifact.message ? {message: artifact.message} : {}),
  artifactPath,
  createdAt: artifact.createdAt,
});

export const listLatestRunSummaries = async (paths: ScalePaths): Promise<CalendarRunSummary[]> => {
  const latestRuns: CalendarRunSummary[] = [];
  let itemDirs: string[];

  try {
    itemDirs = await readdir(paths.runsRoot);
  } catch (error) {
    if ((error as NodeError).code === 'ENOENT') {
      return latestRuns;
    }
    throw error;
  }

  for (const itemDir of itemDirs.sort()) {
    const itemRunDir = path.join(paths.runsRoot, itemDir);
    let runFiles: string[];

    try {
      runFiles = (await readdir(itemRunDir)).filter((file) => file.endsWith('.json')).sort();
    } catch (error) {
      if ((error as NodeError).code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    const artifacts = await Promise.all(
      runFiles.map(async (file) => {
        const artifactPath = path.join(itemRunDir, file);
        const artifact = JSON.parse(await readFile(artifactPath, 'utf8')) as RunArtifact;
        return {artifact, artifactPath};
      }),
    );
    const latest = artifacts.sort(
      (left, right) =>
        left.artifact.createdAt.localeCompare(right.artifact.createdAt) ||
        left.artifactPath.localeCompare(right.artifactPath),
    ).at(-1);

    if (latest) {
      latestRuns.push(runSummaryFromArtifact(latest.artifact, latest.artifactPath));
    }
  }

  return latestRuns.sort((left, right) => left.itemId.localeCompare(right.itemId));
};
