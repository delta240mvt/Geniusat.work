import {DatabaseSync} from 'node:sqlite';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';

import type {ViralBrainsDashboard} from './types.js';

export async function readViralBrainsDashboard(dataRoot: string): Promise<ViralBrainsDashboard> {
  const databasePath = path.join(dataRoot, 'brains.sqlite');
  if (!(await exists(databasePath))) {
    return emptyDashboard();
  }

  const database = new DatabaseSync(databasePath);
  try {
    const runs = (database.prepare('SELECT id, status, analysis_status, started_at, finished_at, spent_credits, error_summary FROM runs ORDER BY created_at DESC').all() as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      status: String(row.status),
      analysisStatus: String(row.analysis_status),
      startedAt: row.started_at ? String(row.started_at) : null,
      finishedAt: row.finished_at ? String(row.finished_at) : null,
      spentCredits: Number(row.spent_credits ?? 0),
      errorSummary: row.error_summary ? String(row.error_summary) : null,
    }));
    const candidates: ViralBrainsDashboard['candidates'] = (database.prepare('SELECT * FROM candidates ORDER BY discovery_score DESC').all() as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      platform: String(row.platform),
      language: String(row.language),
      subtopic: String(row.subtopic),
      sourceQuery: String(row.source_query),
      sourceUrl: String(row.source_url),
      contentType: String(row.content_type),
      text: row.text ? String(row.text) : null,
      publishedAt: row.published_at ? String(row.published_at) : null,
      metrics: parseJson<Record<string, number | null>>(row.metrics, {}),
      discoveryScore: Number(row.discovery_score),
      finalScore: row.final_score === null ? null : Number(row.final_score),
      scoreComponents: parseJson<Record<string, number>>(row.score_components, {}),
      enrichmentStatus: String(row.enrichment_status),
      comments: readComments(database, String(row.id)),
      transcript: readTranscript(database, String(row.id)),
      analysis: null,
    }));

    for (const candidate of candidates) {
      const itemPath = path.join(dataRoot, candidate.runId, 'analysis', 'items', `${safeFileName(candidate.id)}.json`);
      candidate.analysis = await readJsonIfExists(itemPath);
    }

    const reports = [] as ViralBrainsDashboard['reports'];
    const reportRows = database.prepare('SELECT run_id, report_type, markdown_path, json_path FROM reports ORDER BY rowid DESC').all() as Record<string, unknown>[];
    for (const row of reportRows) {
      const jsonPath = path.join(dataRoot, String(row.json_path));
      reports.push({
        runId: String(row.run_id),
        type: String(row.report_type),
        markdownPath: String(row.markdown_path),
        jsonPath: String(row.json_path),
        document: await readJsonIfExists(jsonPath),
      });
    }

    return {generatedAt: new Date().toISOString(), runs, candidates, reports};
  } finally {
    database.close();
  }
}

function readComments(database: DatabaseSync, candidateId: string) {
  return (database.prepare('SELECT platform_comment_id, author, text, likes FROM comments WHERE candidate_id = ? ORDER BY likes DESC LIMIT 20').all(candidateId) as Record<string, unknown>[]).map((row) => ({
    id: String(row.platform_comment_id),
    author: row.author ? String(row.author) : null,
    text: String(row.text),
    likes: row.likes === null ? null : Number(row.likes),
  }));
}

function readTranscript(database: DatabaseSync, candidateId: string) {
  const row = database.prepare('SELECT text, language, confidence, status FROM transcripts WHERE candidate_id = ?').get(candidateId) as Record<string, unknown> | undefined;
  if (!row || row.status !== 'complete' || typeof row.text !== 'string') return null;
  return {
    text: row.text,
    language: row.language ? String(row.language) : null,
    confidence: row.confidence === null ? null : Number(row.confidence),
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function emptyDashboard(): ViralBrainsDashboard {
  return {generatedAt: new Date().toISOString(), runs: [], candidates: [], reports: []};
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}
