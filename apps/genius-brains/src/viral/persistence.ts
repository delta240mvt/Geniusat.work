import {DatabaseSync} from 'node:sqlite';

import type {BudgetSnapshot} from './budget.js';
import type {ViralCandidate, ViralRun} from './types.js';

type SqlRow = Record<string, unknown>;

export interface RunCreateInput {
  runId: string;
  configHash: string;
}

export class ViralBrainsRepository {
  private constructor(private readonly database: DatabaseSync) {
    this.migrate();
  }

  static inMemory(): ViralBrainsRepository {
    return new ViralBrainsRepository(new DatabaseSync(':memory:'));
  }

  static open(filePath: string): ViralBrainsRepository {
    return new ViralBrainsRepository(new DatabaseSync(filePath));
  }

  createRun(input: RunCreateInput): void {
    this.database
      .prepare(
        `INSERT INTO runs (id, status, analysis_status, started_at, config_hash, spent_credits, reserved_credits)
         VALUES (?, 'planned', 'pending', NULL, ?, 0, 0)`,
      )
      .run(input.runId, input.configHash);
  }

  getRun(runId: string): ViralRun | null {
    const row = this.database.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as SqlRow | undefined;
    return row ? this.toRun(row) : null;
  }

  listRuns(): ViralRun[] {
    return (this.database.prepare('SELECT * FROM runs ORDER BY created_at DESC').all() as SqlRow[]).map((row) =>
      this.toRun(row),
    );
  }

  startRun(runId: string, startedAt: string): void {
    this.database.prepare("UPDATE runs SET status = 'running', started_at = ? WHERE id = ?").run(startedAt, runId);
  }

  finishRun(
    runId: string,
    status: ViralRun['status'],
    finishedAt: string,
    budget: BudgetSnapshot,
    errorSummary?: string | null,
  ): void {
    this.database
      .prepare(
        'UPDATE runs SET status = ?, finished_at = ?, spent_credits = ?, reserved_credits = ?, error_summary = ? WHERE id = ?',
      )
      .run(status, finishedAt, budget.spentCredits, budget.reservedCredits, errorSummary ?? null, runId);
  }

  setAnalysisStatus(runId: string, status: ViralRun['analysisStatus']): void {
    this.database.prepare('UPDATE runs SET analysis_status = ? WHERE id = ?').run(status, runId);
  }

  insertCandidate(candidate: ViralCandidate): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO candidates (
          id, run_id, platform, language, subtopic, source_query, source_post_id,
          source_url, content_type, text, media_urls, thumbnail_url, published_at,
          author, metrics, discovery_score, final_score, score_components,
          raw_payload_path, comments_path, enrichment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .run(
        candidate.candidateId,
        candidate.runId,
        candidate.platform,
        candidate.language,
        candidate.subtopic,
        candidate.sourceQuery,
        candidate.sourcePostId,
        candidate.sourceUrl,
        candidate.contentType,
        candidate.text,
        JSON.stringify(candidate.mediaUrls),
        candidate.thumbnailUrl,
        candidate.publishedAt,
        JSON.stringify(candidate.author),
        JSON.stringify(candidate.metrics),
        candidate.score.discovery,
        candidate.score.final,
        JSON.stringify(candidate.score.components),
        candidate.evidence.rawPayloadPath,
        candidate.evidence.commentsPath,
      );
  }

  listCandidates(runId: string): ViralCandidate[] {
    return (this.database.prepare('SELECT * FROM candidates WHERE run_id = ? ORDER BY discovery_score DESC').all(runId) as SqlRow[]).map(
      (row) => this.toCandidate(row),
    );
  }

  listSelectedCandidates(runId: string): ViralCandidate[] {
    return (this.database
      .prepare("SELECT * FROM candidates WHERE run_id = ? AND enrichment_status IN ('selected', 'enriched', 'failed') ORDER BY discovery_score DESC")
      .all(runId) as SqlRow[]).map((row) => this.toCandidate(row));
  }

  getCandidate(candidateId: string): ViralCandidate | null {
    const row = this.database.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId) as SqlRow | undefined;
    return row ? this.toCandidate(row) : null;
  }

  updateCandidateMetrics(candidateId: string, metrics: ViralCandidate['metrics']): void {
    this.database.prepare('UPDATE candidates SET metrics = ? WHERE id = ?').run(JSON.stringify(metrics), candidateId);
  }

  listComments(candidateId: string): Array<{
    id: string;
    text: string;
    author: string | null;
    likes: number | null;
  }> {
    return (this.database.prepare('SELECT * FROM comments WHERE candidate_id = ? ORDER BY likes DESC').all(candidateId) as SqlRow[]).map(
      (row) => ({
        id: String(row.platform_comment_id),
        text: String(row.text),
        author: row.author ? String(row.author) : null,
        likes: row.likes === null ? null : Number(row.likes),
      }),
    );
  }

  getTranscript(candidateId: string): {
    text: string;
    language: string | null;
    confidence: number | null;
    artifactPath: string | null;
  } | null {
    const row = this.database.prepare('SELECT * FROM transcripts WHERE candidate_id = ?').get(candidateId) as SqlRow | undefined;
    if (!row || row.status !== 'complete' || typeof row.text !== 'string') return null;
    return {
      text: row.text,
      language: row.language ? String(row.language) : null,
      confidence: row.confidence === null ? null : Number(row.confidence),
      artifactPath: row.artifact_path ? String(row.artifact_path) : null,
    };
  }

  setCandidateEnrichmentStatus(candidateId: string, status: string, commentsPath: string | null): void {
    this.database
      .prepare('UPDATE candidates SET enrichment_status = ?, comments_path = ? WHERE id = ?')
      .run(status, commentsPath, candidateId);
  }

  insertCall(input: {
    runId: string;
    variant: string;
    endpoint: string;
    requestFingerprint: string;
    estimatedCost: number;
    actualCredits: number;
    status: string;
    requestId?: string | null;
    rawPayloadPath?: string | null;
    error?: string | null;
  }): void {
    this.database
      .prepare(
        `INSERT INTO crawl_calls
         (run_id, variant, endpoint, request_fingerprint, estimated_cost, actual_credits, status, request_id, raw_payload_path, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.runId,
        input.variant,
        input.endpoint,
        input.requestFingerprint,
        input.estimatedCost,
        input.actualCredits,
        input.status,
        input.requestId ?? null,
        input.rawPayloadPath ?? null,
        input.error ?? null,
      );
  }

  insertComment(input: {
    candidateId: string;
    platformCommentId: string;
    author: string | null;
    text: string;
    likes: number | null;
    replies: number | null;
    parentId: string | null;
    publishedAt: string | null;
    rawEvidencePath: string | null;
  }): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO comments
         (candidate_id, platform_comment_id, author, text, likes, replies, parent_id, published_at, raw_evidence_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.candidateId,
        input.platformCommentId,
        input.author,
        input.text,
        input.likes,
        input.replies,
        input.parentId,
        input.publishedAt,
        input.rawEvidencePath,
      );
  }

  insertTranscript(input: {
    candidateId: string;
    provider: string;
    model: string;
    status: string;
    language: string | null;
    confidence: number | null;
    text: string | null;
    artifactPath: string | null;
    error?: string | null;
  }): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO transcripts
         (candidate_id, provider, model, status, language, confidence, text, artifact_path, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.candidateId,
        input.provider,
        input.model,
        input.status,
        input.language,
        input.confidence,
        input.text,
        input.artifactPath,
        input.error ?? null,
      );
  }

  insertArtefact(input: {
    runId: string;
    candidateId?: string | null;
    kind: string;
    path: string;
    mediaType?: string | null;
    bytes?: number | null;
  }): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO artefacts
         (run_id, candidate_id, kind, path, media_type, bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.runId,
        input.candidateId ?? null,
        input.kind,
        input.path,
        input.mediaType ?? null,
        input.bytes ?? null,
      );
  }

  insertAnalysis(input: {candidateId: string; schemaVersion: string; artifactPath: string; status: string}): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO analyses (candidate_id, schema_version, artifact_path, status)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.candidateId, input.schemaVersion, input.artifactPath, input.status);
  }

  insertReport(input: {runId: string; reportType: string; schemaVersion: string; jsonPath: string; markdownPath: string}): void {
    this.database
      .prepare(
        `INSERT OR REPLACE INTO reports (run_id, report_type, schema_version, json_path, markdown_path)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.runId, input.reportType, input.schemaVersion, input.jsonPath, input.markdownPath);
  }

  close(): void {
    this.database.close();
  }

  private migrate(): void {
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        analysis_status TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        config_hash TEXT NOT NULL,
        spent_credits INTEGER NOT NULL DEFAULT 0,
        reserved_credits INTEGER NOT NULL DEFAULT 0,
        error_summary TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS crawl_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        variant TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        estimated_cost INTEGER NOT NULL,
        actual_credits INTEGER NOT NULL,
        status TEXT NOT NULL,
        request_id TEXT,
        raw_payload_path TEXT,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        language TEXT NOT NULL,
        subtopic TEXT NOT NULL,
        source_query TEXT NOT NULL,
        source_post_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        content_type TEXT NOT NULL,
        text TEXT,
        media_urls TEXT NOT NULL,
        thumbnail_url TEXT,
        published_at TEXT,
        author TEXT NOT NULL,
        metrics TEXT NOT NULL,
        discovery_score REAL NOT NULL,
        final_score REAL,
        score_components TEXT NOT NULL,
        raw_payload_path TEXT NOT NULL,
        comments_path TEXT,
        enrichment_status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        platform_comment_id TEXT NOT NULL,
        author TEXT,
        text TEXT NOT NULL,
        likes INTEGER,
        replies INTEGER,
        parent_id TEXT,
        published_at TEXT,
        raw_evidence_path TEXT,
        PRIMARY KEY (candidate_id, platform_comment_id)
      );
      CREATE TABLE IF NOT EXISTS transcripts (
        candidate_id TEXT PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL,
        language TEXT,
        confidence REAL,
        text TEXT,
        artifact_path TEXT,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS analyses (
        candidate_id TEXT PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
        schema_version TEXT NOT NULL,
        artifact_path TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reports (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        report_type TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        json_path TEXT NOT NULL,
        markdown_path TEXT NOT NULL,
        PRIMARY KEY (run_id, report_type)
      );
      CREATE TABLE IF NOT EXISTS artefacts (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        candidate_id TEXT REFERENCES candidates(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        media_type TEXT,
        bytes INTEGER,
        PRIMARY KEY (run_id, candidate_id, kind, path)
      );
    `);
  }

  private toRun(row: SqlRow): ViralRun {
    return {
      runId: String(row.id),
      status: String(row.status) as ViralRun['status'],
      analysisStatus: String(row.analysis_status) as ViralRun['analysisStatus'],
      startedAt: row.started_at ? String(row.started_at) : null,
      finishedAt: row.finished_at ? String(row.finished_at) : null,
      configHash: String(row.config_hash),
      spentCredits: Number(row.spent_credits),
      reservedCredits: Number(row.reserved_credits),
      errorSummary: row.error_summary ? String(row.error_summary) : null,
    };
  }

  private toCandidate(row: SqlRow): ViralCandidate {
    return {
      candidateId: String(row.id),
      runId: String(row.run_id),
      platform: String(row.platform) as ViralCandidate['platform'],
      language: String(row.language) as ViralCandidate['language'],
      subtopic: String(row.subtopic),
      sourceQuery: String(row.source_query),
      sourcePostId: String(row.source_post_id),
      sourceUrl: String(row.source_url),
      contentType: String(row.content_type) as ViralCandidate['contentType'],
      text: row.text ? String(row.text) : null,
      mediaUrls: JSON.parse(String(row.media_urls)) as string[],
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      publishedAt: row.published_at ? String(row.published_at) : null,
      author: JSON.parse(String(row.author)) as ViralCandidate['author'],
      metrics: JSON.parse(String(row.metrics)) as ViralCandidate['metrics'],
      score: {
        discovery: Number(row.discovery_score),
        final: row.final_score === null ? null : Number(row.final_score),
        components: JSON.parse(String(row.score_components)) as Record<string, number>,
      },
      evidence: {
        rawPayloadPath: String(row.raw_payload_path),
        commentsPath: row.comments_path ? String(row.comments_path) : null,
      },
    };
  }
}
