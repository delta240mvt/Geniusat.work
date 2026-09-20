import {describe, expect, it, vi} from 'vitest';

import {DeepgramClient} from '../src/viral/deepgram.js';

describe('Deepgram transcription client', () => {
  it('uses URL transcription and falls back to downloading expired media', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('expired', {status: 403}))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {status: 200, headers: {'content-type': 'video/mp4'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: {
          channels: [{alternatives: [{transcript: 'Build with AI', confidence: 0.91, words: [{word: 'Build', start: 0, end: 0.4}]}]}],
        },
      }), {status: 200, headers: {'content-type': 'application/json'}}));

    const client = new DeepgramClient({apiKey: 'dg-test', fetchImpl});
    const result = await client.transcribeUrl('https://cdn.example/expired.mp4');

    expect(result).toMatchObject({text: 'Build with AI', confidence: 0.91, words: [{word: 'Build'}]});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain('diarize=true');
  });

  it('adds diarization only when the caller marks media as multi-speaker', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      results: {channels: [{alternatives: [{transcript: 'Two voices', words: [{word: 'Two', start: 0, end: 0.2}]}]}]},
    }), {status: 200, headers: {'content-type': 'application/json'}}));
    await new DeepgramClient({apiKey: 'dg-test', fetchImpl}).transcribeUrl('https://cdn.example/two-voices.mp4', {diarize: true});
    expect(String(fetchImpl.mock.calls[0][0])).toContain('diarize=true');
  });
});
