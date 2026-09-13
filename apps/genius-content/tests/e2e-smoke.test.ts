import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {runTranscriptStage} from '../src/lib/transcript-stage.js';

describe('smoke transcript stage', () => {
  it('produces transcript artifacts for a local MOV', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gaclight-smoke-'));
    const inputPath = path.join(tempDir, 'test-input.MOV');
    await writeFile(inputPath, 'stub');
    const result = await runTranscriptStage(
      {inputPath,outputRoot:path.join(tempDir,'output')},
      {
        transcribeWithWhisper: async () => ({
          segments: [
            {
              start: 0,
              end: 1,
              text: 'to jest probka',
              words: [{start: 0, end: 1, word: 'to'}],
            },
          ],
        }),
        cleanupTranscript: async ({speech}) => ({
          provider: 'fallback',
          model: 'test-cleaner',
          rawResponse: null,
          cleanedSpeech: speech,
        }),
      },
    );

    expect(result.whisperRawPath).toMatch(/output[\\/]+analysis[\\/]+.+-whisper-raw\.json$/);
    expect(result.transcriptCleanPath).toMatch(/output[\\/]+pipeline[\\/]+.+[\\/]00-transcript-clean\.json$/);
  });
});
