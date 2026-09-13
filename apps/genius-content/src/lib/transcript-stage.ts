import path from 'node:path';
import {writeFile} from 'node:fs/promises';

import {assertInputExists, getVideoId, resolveTranscriptCleanPath, resolveWhisperRawPath, writeJson} from './paths.js';
import {transcribeWithLocalWhisper, type WhisperResult} from './local-whisper.js';
import {cleanTranscriptWithAi, type TranscriptSpeechSegment} from './transcript-cleanup.js';
import {resolveContentRoot} from './app-root.js';

const toMs = (value?: number) => Math.max(0, Math.round((value ?? 0) * 1000));

const mapWhisperSpeech = (result: WhisperResult): TranscriptSpeechSegment[] =>
  (result.segments ?? [])
    .map((segment) => ({
      startMs: toMs(segment.start),
      endMs: Math.max(toMs(segment.end), toMs(segment.start) + 200),
      text: (segment.text ?? '').trim(),
      words: (segment.words ?? [])
        .map((word) => ({
          startMs: toMs(word.start),
          endMs: Math.max(toMs(word.end), toMs(word.start) + 80),
          word: (word.word ?? '').trim(),
        }))
        .filter((word) => word.word.length > 0),
    }))
    .filter((segment) => segment.text.length > 0);

export const buildTranscriptMarkdown = ({
  videoId,
  provider,
  model,
  speech,
}: {
  videoId: string;
  provider: string;
  model: string;
  speech: TranscriptSpeechSegment[];
}) => {
  const formatMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    const millis = (ms % 1000).toString().padStart(3, '0');
    return `${minutes}:${seconds}.${millis}`;
  };

  return [
    `# Transcript cleanup: ${videoId}`,
    '',
    `- provider: ${provider}`,
    `- model: ${model}`,
    `- segments: ${speech.length}`,
    '',
    ...speech.flatMap((segment, index) => [
      `## ${String(index + 1).padStart(2, '0')} [${formatMs(segment.startMs)} -> ${formatMs(segment.endMs)}]`,
      '',
      segment.text,
      '',
    ]),
  ].join('\n');
};

export type TranscriptStageResult = {
  videoId: string;
  whisperRawPath: string;
  transcriptCleanPath: string;
  transcriptMarkdownPath: string;
  provider: 'gemini' | 'fallback';
  model: string;
  speech: TranscriptSpeechSegment[];
};

type TranscriptStageDependencies = {
  transcribeWithWhisper: (inputPath: string) => Promise<WhisperResult>;
  cleanupTranscript: typeof cleanTranscriptWithAi;
};

export const runTranscriptStage = async (
  {
    inputPath,
    outputRoot,
  }: {
    inputPath: string;
    outputRoot?: string;
  },
  dependencies?: Partial<TranscriptStageDependencies>,
): Promise<TranscriptStageResult> => {
  await assertInputExists(inputPath);
  const videoId = getVideoId(inputPath);
  const whisperRawPath = outputRoot ? path.join(outputRoot,'analysis',`${videoId}-whisper-raw.json`) : resolveWhisperRawPath(videoId);
  const transcriptCleanPath = outputRoot ? path.join(outputRoot,'pipeline',videoId,'00-transcript-clean.json') : resolveTranscriptCleanPath(videoId);
  const transcriptMarkdownPath = path.join(path.dirname(transcriptCleanPath),'00-transcript-clean.md');
  const transcribe = dependencies?.transcribeWithWhisper ?? transcribeWithLocalWhisper;
  const cleanup = dependencies?.cleanupTranscript ?? cleanTranscriptWithAi;

  const whisperResult = await transcribe(inputPath);
  await writeJson(whisperRawPath, whisperResult);

  const rawSpeech = mapWhisperSpeech(whisperResult);
  const cleanupResult = await cleanup({
    speech: rawSpeech,
    apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_VIDEO_INTELLIGENCE_API_KEY,
  });

  const cleanPayload = {
    videoId,
    sourceVideo: inputPath,
    provider: cleanupResult.provider,
    model: cleanupResult.model,
    whisperRawPath,
    cleanupRawResponse: cleanupResult.rawResponse,
    speech: cleanupResult.cleanedSpeech,
  };

  await writeJson(transcriptCleanPath, cleanPayload);
  await writeJson(outputRoot ? path.join(outputRoot,'analysis',`${videoId}-cleanup-report.json`) : resolveContentRoot('output', 'analysis', `${videoId}-cleanup-report.json`), {
    videoId,
    provider: cleanupResult.provider,
    model: cleanupResult.model,
    segmentCount: cleanupResult.cleanedSpeech.length,
    transcriptCleanPath,
    transcriptMarkdownPath,
  });
  await writeFile(
    transcriptMarkdownPath,
    buildTranscriptMarkdown({
      videoId,
      provider: cleanupResult.provider,
      model: cleanupResult.model,
      speech: cleanupResult.cleanedSpeech,
    }),
    'utf8',
  );

  return {
    videoId,
    whisperRawPath,
    transcriptCleanPath,
    transcriptMarkdownPath,
    provider: cleanupResult.provider,
    model: cleanupResult.model,
    speech: cleanupResult.cleanedSpeech,
  };
};
