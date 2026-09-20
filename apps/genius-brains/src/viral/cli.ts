import {mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';

import {parseViralIntelligenceConfig} from './config.js';
import {DeepgramClient} from './deepgram.js';
import {prepareAnalysisPack, recordTranscriptionUnavailable, transcribeSelectedCandidates, ingestCodexAnalysis} from './analysis-runner.js';
import {runViralCrawl} from './crawl.js';
import {ViralBrainsRepository} from './persistence.js';
import {SocialCrawlClient} from './socialcrawl.js';

export async function runViralCommand(command: string, argv: string[]): Promise<string> {
  switch (command) {
    case 'crawl':
      return runCrawlCommand(argv);
    case 'analyze':
      return runAnalyzeCommand(argv);
    case 'report':
      return runReportCommand(argv);
    case 'list-runs':
      return runListRunsCommand();
    default:
      throw new Error(`Unknown Genius@Brains viral command: ${command}`);
  }
}

async function runCrawlCommand(argv: string[]): Promise<string> {
  const configPath = readOption(argv, '--config');
  const config = parseViralIntelligenceConfig(
    configPath
      ? JSON.parse(await readFile(configPath, 'utf8'))
      : {niche: 'AI', subtopics: ['AI agents', 'AI coding', 'AI automation', 'AI marketing', 'AI productivity']},
  );
  const dataRoot = resolveDataRoot();
  await mkdir(dataRoot, {recursive: true});
  const repository = openRepository(dataRoot);
  const runId = readOption(argv, '--run-id') ?? `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const result = await runViralCrawl({
    config,
    client: new SocialCrawlClient({apiKey: requireEnv('SOCIALCRAWL_API_KEY')}),
    repository,
    dataRoot,
    runId,
  });
  repository.close();
  return JSON.stringify({runId, status: result.run.status, candidates: result.candidates.length, selected: result.selectedCandidates.length, budget: result.budget}, null, 2);
}

async function runAnalyzeCommand(argv: string[]): Promise<string> {
  const runId = requireOption(argv, '--run-id');
  const dataRoot = resolveDataRoot();
  const repository = openRepository(dataRoot);
  if (!repository.getRun(runId)) {
    repository.close();
    throw new Error(`Run not found: ${runId}`);
  }
  const candidates = repository.listSelectedCandidates(runId);
  repository.setAnalysisStatus(runId, 'running');

  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
  const transcription = deepgramKey
    ? await transcribeSelectedCandidates({
        runId,
        dataRoot,
        candidates,
        repository,
        client: new DeepgramClient({apiKey: deepgramKey}),
      })
    : recordTranscriptionUnavailable({candidates, repository, reason: 'DEEPGRAM_API_KEY is missing.'});
  const prepared = await prepareAnalysisPack({runId, dataRoot, repository});
  const codexOutput = readOption(argv, '--codex-output');
  if (codexOutput) {
    const report = await ingestCodexAnalysis({runId, dataRoot, repository, inputPath: codexOutput});
    repository.close();
    return JSON.stringify({runId, packPath: prepared.packPath, reportPath: report.markdownPath, transcription}, null, 2);
  }

  repository.close();
  return JSON.stringify({runId, packPath: prepared.packPath, promptPath: prepared.promptPath, transcription, next: `Run Codex against ${prepared.packPath}, save JSON, then rerun with --codex-output <path>.`}, null, 2);
}

async function runReportCommand(argv: string[]): Promise<string> {
  const runId = requireOption(argv, '--run-id');
  return path.join(resolveDataRoot(), runId, 'reports', 'viral-intelligence.md');
}

async function runListRunsCommand(): Promise<string> {
  const repository = openRepository(resolveDataRoot());
  const runs = repository.listRuns();
  repository.close();
  return JSON.stringify(runs, null, 2);
}

function openRepository(dataRoot: string): ViralBrainsRepository {
  return ViralBrainsRepository.open(path.join(dataRoot, 'brains.sqlite'));
}

function resolveDataRoot(): string {
  return path.resolve(process.env.GENIUS_BRAINS_DATA_ROOT ?? path.join(process.cwd(), 'apps', 'genius-brains', 'output', 'viral'));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requireOption(argv: string[], name: string): string {
  const value = readOption(argv, name)?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function readOption(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name) return argv[index + 1];
    if (argv[index].startsWith(`${name}=`)) return argv[index].slice(name.length + 1);
  }
  return undefined;
}
