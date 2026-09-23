import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

import {runViralCommand} from '../src/viral/cli.js';
import {ViralBrainsRepository} from '../src/viral/persistence.js';

describe('viral CLI integration', () => {
  it('ingests Codex output without retranscribing or replacing an existing transcript', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'genius-viral-cli-'));
    const repository = ViralBrainsRepository.open(path.join(root, 'brains.sqlite'));
    repository.createRun({runId: 'run-1', configHash: 'test'});
    repository.insertCandidate({
      candidateId: 'instagram:1', runId: 'run-1', platform: 'instagram', language: 'en', subtopic: 'AI agents',
      sourceQuery: 'AI agents', sourcePostId: '1', sourceUrl: 'https://instagram.com/reel/1', contentType: 'reel',
      text: 'AI agents', mediaUrls: ['https://cdn.example/video.mp4'], thumbnailUrl: null,
      publishedAt: '2026-09-20T10:00:00.000Z', author: {username: 'creator', displayName: 'Creator'},
      metrics: {views: 1000, likes: 100, comments: 20, replies: 0, reposts: 0, shares: null},
      score: {discovery: 80, final: null, components: {}},
      evidence: {rawPayloadPath: 'run-1/raw.json', commentsPath: null},
    });
    repository.setCandidateEnrichmentStatus('instagram:1', 'selected', null);
    repository.insertTranscript({candidateId: 'instagram:1', provider: 'deepgram', model: 'nova-3', status: 'complete', language: 'en', confidence: 0.95, text: 'Original transcript', artifactPath: null});
    repository.close();
    const document = {
      schemaVersion: '1.0', runId: 'run-1',
      items: [{candidateId: 'instagram:1', summary: 'Summary', topic: 'AI', hook: 'Hook', structure: ['start'], viralMechanisms: [{label: 'clarity', evidenceRefs: ['instagram:1']}], commentThemes: [{label: 'interest', evidenceRefs: ['instagram:1']}], transcriptInsights: [], adaptationIdeas: ['Idea'], risks: [], uncertainties: [], confidence: 0.7, evidenceRefs: ['instagram:1']}],
      synthesis: {recurringTopics: ['AI'], recurringHooks: ['Hook'], recurringStructures: ['start'], commentPatterns: ['interest'], platformDifferences: [], recommendations: ['Idea'], evidenceRefs: ['instagram:1']},
    };
    const outputPath = path.join(root, 'codex-output.json');
    await writeFile(outputPath, JSON.stringify(document));
    const previousRoot = process.env.GENIUS_BRAINS_DATA_ROOT;
    const previousKey = process.env.DEEPGRAM_API_KEY;
    process.env.GENIUS_BRAINS_DATA_ROOT = root;
    delete process.env.DEEPGRAM_API_KEY;
    try {
      await runViralCommand('analyze', ['--run-id', 'run-1', '--codex-output', outputPath]);
      const updated = ViralBrainsRepository.open(path.join(root, 'brains.sqlite'));
      expect(updated.getTranscript('instagram:1')?.text).toBe('Original transcript');
      expect(updated.getRun('run-1')?.analysisStatus).toBe('complete');
      updated.close();
    } finally {
      if (previousRoot === undefined) delete process.env.GENIUS_BRAINS_DATA_ROOT;
      else process.env.GENIUS_BRAINS_DATA_ROOT = previousRoot;
      if (previousKey === undefined) delete process.env.DEEPGRAM_API_KEY;
      else process.env.DEEPGRAM_API_KEY = previousKey;
    }
  });
});
