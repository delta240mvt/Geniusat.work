import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {buildAnalysisPack, createAnalysisPrompt, isTranscriptEligible, parseCodexAnalysisDocument, type AnalysisPack, type CodexAnalysisDocument} from './analysis.js';
import {DeepgramClient} from './deepgram.js';
import {ViralBrainsRepository} from './persistence.js';
import type {ViralCandidate} from './types.js';

export async function prepareAnalysisPack(options: {
  runId: string;
  dataRoot: string;
  repository: ViralBrainsRepository;
}): Promise<{pack: AnalysisPack; packPath: string; promptPath: string}> {
  const candidates = options.repository.listSelectedCandidates(options.runId);
  const pack = buildAnalysisPack({
    runId: options.runId,
    candidates,
    commentsByCandidate: Object.fromEntries(candidates.map((candidate) => [candidate.candidateId, options.repository.listComments(candidate.candidateId)])),
    transcriptsByCandidate: Object.fromEntries(candidates.flatMap((candidate) => {
      const transcript = options.repository.getTranscript(candidate.candidateId);
      return transcript ? [[candidate.candidateId, transcript]] : [];
    })),
  });
  const analysisRoot = path.join(options.dataRoot, options.runId, 'analysis');
  await mkdir(analysisRoot, {recursive: true});
  const packPath = path.join(analysisRoot, 'analysis-pack.json');
  const promptPath = path.join(analysisRoot, 'analysis-prompt.md');
  await writeJson(packPath, pack);
  await writeFile(promptPath, `${createAnalysisPrompt(pack)}\n`, 'utf8');
  return {pack, packPath, promptPath};
}

export async function transcribeSelectedCandidates(options: {
  runId: string;
  dataRoot: string;
  candidates: ViralCandidate[];
  repository: ViralBrainsRepository;
  client: DeepgramClient;
  shouldDiarize?: (candidate: ViralCandidate) => boolean;
}): Promise<{completed: number; failed: number; skipped: number}> {
  const counters = {completed: 0, failed: 0, skipped: 0};
  const transcriptRoot = path.join(options.dataRoot, options.runId, 'transcripts');
  await mkdir(transcriptRoot, {recursive: true});

  for (const candidate of options.candidates) {
    if (!isTranscriptEligible(candidate)) {
      options.repository.insertTranscript({
        candidateId: candidate.candidateId,
        provider: 'deepgram',
        model: 'nova-3',
        status: 'skipped_no_media',
        language: candidate.language,
        confidence: null,
        text: null,
        artifactPath: null,
      });
      counters.skipped += 1;
      continue;
    }

    try {
      const transcript = await options.client.transcribeUrl(candidate.mediaUrls[0], {diarize: options.shouldDiarize?.(candidate) ?? false});
      const artifactPath = path.join(transcriptRoot, `${safeFileName(candidate.candidateId)}.json`);
      await writeJson(artifactPath, transcript);
      options.repository.insertArtefact({
        runId: options.runId,
        candidateId: candidate.candidateId,
        kind: 'deepgram-transcript',
        path: path.relative(options.dataRoot, artifactPath).replaceAll(path.sep, '/'),
        mediaType: 'application/json',
      });
      options.repository.insertTranscript({
        candidateId: candidate.candidateId,
        provider: 'deepgram',
        model: 'nova-3',
        status: 'complete',
        language: transcript.language ?? candidate.language,
        confidence: transcript.confidence,
        text: transcript.text,
        artifactPath: path.relative(options.dataRoot, artifactPath).replaceAll(path.sep, '/'),
      });
      counters.completed += 1;
    } catch (error) {
      options.repository.insertTranscript({
        candidateId: candidate.candidateId,
        provider: 'deepgram',
        model: 'nova-3',
        status: 'failed',
        language: candidate.language,
        confidence: null,
        text: null,
        artifactPath: null,
        error: error instanceof Error ? error.message : String(error),
      });
      counters.failed += 1;
    }
  }

  return counters;
}

export function recordTranscriptionUnavailable(options: {
  candidates: ViralCandidate[];
  repository: ViralBrainsRepository;
  reason: string;
}): {completed: number; failed: number; skipped: number} {
  const counters = {completed: 0, failed: 0, skipped: 0};
  for (const candidate of options.candidates) {
    const eligible = isTranscriptEligible(candidate);
    options.repository.insertTranscript({
      candidateId: candidate.candidateId,
      provider: 'deepgram',
      model: 'nova-3',
      status: eligible ? 'failed' : 'skipped_no_media',
      language: candidate.language,
      confidence: null,
      text: null,
      artifactPath: null,
      ...(eligible ? {error: options.reason} : {}),
    });
    if (eligible) counters.failed += 1;
    else counters.skipped += 1;
  }
  return counters;
}

export async function ingestCodexAnalysis(options: {
  runId: string;
  dataRoot: string;
  repository: ViralBrainsRepository;
  inputPath: string;
}): Promise<{document: CodexAnalysisDocument; markdownPath: string; jsonPath: string}> {
  const document = parseCodexAnalysisDocument(JSON.parse(await readFile(options.inputPath, 'utf8')));
  if (document.runId !== options.runId) throw new Error('Codex output belongs to ' + document.runId + ', expected ' + options.runId + '.');
  const selectedIds = new Set(options.repository.listSelectedCandidates(options.runId).map((candidate) => candidate.candidateId));
  const documentIds = new Set(document.items.map((item) => item.candidateId));
  const missing = [...selectedIds].filter((candidateId) => !documentIds.has(candidateId));
  const unexpected = [...documentIds].filter((candidateId) => !selectedIds.has(candidateId));
  if (missing.length || unexpected.length) {
    throw new Error('Codex output candidate mismatch. Missing: ' + (missing.join(', ') || 'none') + '; unexpected: ' + (unexpected.join(', ') || 'none') + '.');
  }
  const reportRoot = path.join(options.dataRoot, options.runId, 'reports');
  const itemRoot = path.join(options.dataRoot, options.runId, 'analysis', 'items');
  await mkdir(reportRoot, {recursive: true});
  await mkdir(itemRoot, {recursive: true});

  for (const item of document.items) {
    const itemPath = path.join(itemRoot, `${safeFileName(item.candidateId)}.json`);
    await writeJson(itemPath, item);
    options.repository.insertArtefact({
      runId: options.runId,
      candidateId: item.candidateId,
      kind: 'codex-analysis',
      path: path.relative(options.dataRoot, itemPath).replaceAll(path.sep, '/'),
      mediaType: 'application/json',
    });
    options.repository.insertAnalysis({
      candidateId: item.candidateId,
      schemaVersion: document.schemaVersion,
      artifactPath: path.relative(options.dataRoot, itemPath).replaceAll(path.sep, '/'),
      status: 'complete',
    });
  }

  const jsonPath = path.join(reportRoot, 'viral-intelligence.json');
  const markdownPath = path.join(reportRoot, 'viral-intelligence.md');
  await writeJson(jsonPath, document);
  await writeFile(markdownPath, renderReport(document), 'utf8');
  options.repository.insertArtefact({
    runId: options.runId,
    kind: 'viral-report-json',
    path: path.relative(options.dataRoot, jsonPath).replaceAll(path.sep, '/'),
    mediaType: 'application/json',
  });
  options.repository.insertArtefact({
    runId: options.runId,
    kind: 'viral-report-markdown',
    path: path.relative(options.dataRoot, markdownPath).replaceAll(path.sep, '/'),
    mediaType: 'text/markdown',
  });
  options.repository.insertReport({
    runId: options.runId,
    reportType: 'viral-intelligence',
    schemaVersion: document.schemaVersion,
    jsonPath: path.relative(options.dataRoot, jsonPath).replaceAll(path.sep, '/'),
    markdownPath: path.relative(options.dataRoot, markdownPath).replaceAll(path.sep, '/'),
  });
  options.repository.setAnalysisStatus(options.runId, 'complete');
  return {document, markdownPath, jsonPath};
}

function renderReport(document: CodexAnalysisDocument): string {
  const lines = ['# Genius@Brains — Viral Intelligence', '', `Run: ${document.runId}`, ''];
  lines.push('## Synthesis', '');
  lines.push('### Recurring topics', ...document.synthesis.recurringTopics.map((item) => `- ${item}`), '');
  lines.push('### Recurring hooks', ...document.synthesis.recurringHooks.map((item) => `- ${item}`), '');
  lines.push('### Structures', ...document.synthesis.recurringStructures.map((item) => `- ${item}`), '');
  lines.push('### Comment patterns', ...document.synthesis.commentPatterns.map((item) => `- ${item}`), '');
  lines.push('### Recommendations', ...document.synthesis.recommendations.map((item) => `- ${item}`), '');
  lines.push('', '## Content analyses', '');
  for (const item of document.items) {
    lines.push(`### ${item.candidateId}`, '', item.summary, '', `Hook: ${item.hook}`, '', `Evidence: ${item.evidenceRefs.join(', ')}`, '');
  }
  return `${lines.join('\n')}\n`;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}
