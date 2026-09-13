import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {buildTranscriptMarkdown, runTranscriptStage} from '../src/lib/transcript-stage.js';

describe('transcript stage', () => {
  it('writes cleaned transcript artifacts for a local video', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gaclight-transcript-'));
    const inputPath = path.join(tempDir, '220426.mp4');
    await writeFile(inputPath, 'stub');

    const result = await runTranscriptStage(
      {inputPath,outputRoot:path.join(tempDir,'output')},
      {
        transcribeWithWhisper: async () => ({
          segments: [
            {
              start: 0,
              end: 1.2,
              text: 'wysylam to do whisper ai',
              words: [
                {start: 0, end: 0.2, word: 'wysylam'},
                {start: 0.2, end: 0.4, word: 'to'},
                {start: 0.4, end: 0.6, word: 'do'},
                {start: 0.6, end: 1.2, word: 'whisper ai'},
              ],
            },
          ],
        }),
        cleanupTranscript: async ({speech}) => ({
          provider: 'gemini',
          model: 'test-model',
          rawResponse: {
            candidates: [{content: {parts: [{text: '{"segments":[]}'}]}}],
          },
          cleanedSpeech: speech.map((segment) => ({
            ...segment,
            text: 'Wysyłam to do Whisper AI.',
            words: [
              {...segment.words[0]!, word: 'Wysyłam'},
              {...segment.words[1]!, word: 'to'},
              {...segment.words[2]!, word: 'do'},
              {...segment.words[3]!, word: 'Whisper AI'},
            ],
          })),
        }),
      },
    );

    const savedJson = JSON.parse(await readFile(result.transcriptCleanPath, 'utf8')) as {
      provider: string;
      model: string;
      speech: Array<{text: string}>;
    };
    const savedMarkdown = await readFile(result.transcriptMarkdownPath, 'utf8');

    expect(savedJson.provider).toBe('gemini');
    expect(savedJson.model).toBe('test-model');
    expect(savedJson.speech[0]?.text).toBe('Wysyłam to do Whisper AI.');
    expect(savedMarkdown).toContain('Wysyłam to do Whisper AI.');
  });

  it('formats transcript markdown with segment timing', () => {
    const markdown = buildTranscriptMarkdown({
      videoId: '220426',
      provider: 'gemini',
      model: 'test-model',
      speech: [
        {
          startMs: 0,
          endMs: 1250,
          text: 'Pierwszy segment.',
          words: [],
        },
      ],
    });

    expect(markdown).toContain('# Transcript cleanup: 220426');
    expect(markdown).toContain('[00:00.000 -> 00:01.250]');
  });
});
