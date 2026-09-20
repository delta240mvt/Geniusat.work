export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  punctuatedWord?: string;
}

export interface DeepgramTranscript {
  text: string;
  confidence: number | null;
  language: string | null;
  words: DeepgramWord[];
  segments: Array<{start: number; end: number; text: string}>;
}

export interface DeepgramClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface DeepgramTranscriptionOptions {
  diarize?: boolean;
}

export class DeepgramClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DeepgramClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.deepgram.com/v1/listen';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribeUrl(mediaUrl: string, transcriptionOptions: DeepgramTranscriptionOptions = {}): Promise<DeepgramTranscript> {
    const query = new URLSearchParams({
      model: 'nova-3',
      language: 'multi',
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
    });
    if (transcriptionOptions.diarize) query.set('diarize', 'true');
    const endpoint = `${this.baseUrl}?${query.toString()}`;
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
       authorization: `Token ${this.options.apiKey}`,
       'content-type': 'application/json',
      },
      body: JSON.stringify({url: mediaUrl}),
    });

    if (response.ok) {
      return parseDeepgramResponse(await response.json());
    }

    if (![401, 403, 404, 410].includes(response.status)) {
      throw new DeepgramError(response.status, await response.text());
    }

    const mediaResponse = await this.fetchImpl(mediaUrl, {headers: {accept: '*/*'}});
    if (!mediaResponse.ok) {
      throw new DeepgramError(mediaResponse.status, `Media download failed for ${mediaUrl}.`);
    }

    const media = new Uint8Array(await mediaResponse.arrayBuffer());
    const uploadResponse = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
       authorization: `Token ${this.options.apiKey}`,
       'content-type': mediaResponse.headers.get('content-type') ?? 'application/octet-stream',
      },
      body: media,
    });
    if (!uploadResponse.ok) {
      throw new DeepgramError(uploadResponse.status, await uploadResponse.text());
    }

    return parseDeepgramResponse(await uploadResponse.json());
  }
}

export class DeepgramError extends Error {
  constructor(public readonly status: number, details: string) {
    super(`Deepgram request failed (${status}): ${details}`);
    this.name = 'DeepgramError';
  }
}

function parseDeepgramResponse(payload: unknown): DeepgramTranscript {
  const root = asRecord(payload);
  const results = asRecord(root?.results);
  const channel = Array.isArray(results?.channels) ? asRecord(results.channels[0]) : null;
  const alternative = Array.isArray(channel?.alternatives) ? asRecord(channel.alternatives[0]) : null;
  const words = Array.isArray(alternative?.words)
    ? alternative.words.flatMap((word) => {
        const record = asRecord(word);
        const text = typeof record?.word === 'string' ? record.word : null;
        const start = typeof record?.start === 'number' ? record.start : null;
        const end = typeof record?.end === 'number' ? record.end : null;
        if (!text || start === null || end === null) return [];
        return [{
          word: text,
          start,
          end,
          confidence: typeof record?.confidence === 'number' ? record.confidence : undefined,
          punctuatedWord: typeof record?.punctuated_word === 'string' ? record.punctuated_word : undefined,
        }];
      })
    : [];

  const transcript = typeof alternative?.transcript === 'string' ? alternative.transcript : '';
  if (!transcript && words.length === 0) {
    throw new DeepgramError(200, 'Deepgram returned no transcript text.');
  }

  return {
    text: transcript,
    confidence: typeof alternative?.confidence === 'number' ? alternative.confidence : null,
    language: typeof channel?.detected_language === 'string' ? channel.detected_language : null,
    words,
    segments: words.length > 0 ? [{start: words[0].start, end: words.at(-1)?.end ?? words[0].end, text: transcript}] : [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
