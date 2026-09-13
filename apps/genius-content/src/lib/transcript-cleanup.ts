import {z} from 'zod';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const transcriptCorrections: Array<[RegExp, string]> = [
  [/\bopenni\b/gi, 'OpenAI'],
  [/\bopen ai\b/gi, 'OpenAI'],
  [/\bchat gpt\b/gi, 'ChatGPT'],
  [/\bremotion\b/gi, 'Remotion'],
  [/\bwhisper ai\b/gi, 'Whisper AI'],
  [/\bgoogle intelligence\b/gi, 'Google Video Intelligence'],
  [/\bgoogle video intelligence\b/gi, 'Google Video Intelligence'],
  [/\bfire crawl\b/gi, 'Firecrawl'],
  [/\bscrapera\b/gi, 'scrapera'],
  [/\bcloud design\b/gi, 'cloud design'],
  [/\blucie\b/gi, 'LUT-cie'],
];

export type TranscriptSpeechSegment = {
  startMs: number;
  endMs: number;
  text: string;
  words: Array<{
    startMs: number;
    endMs: number;
    word: string;
  }>;
};

const aiResponseSchema = z.object({
  segments: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      text: z.string().min(1),
      words: z.array(z.string().min(1)).optional(),
    }),
  ),
});

const applyTranscriptCorrections = (value: string) =>
  transcriptCorrections.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value).trim();

const normalizePunctuation = (value: string) =>
  value
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])([^\s])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

const cleanupTextDeterministically = (value: string) => normalizePunctuation(applyTranscriptCorrections(value));

const mergeWords = (segment: TranscriptSpeechSegment, words?: string[]) => {
  if (!words?.length || words.length !== segment.words.length) {
    return segment.words.map((word) => ({
      ...word,
      word: cleanupTextDeterministically(word.word),
    }));
  }

  return segment.words.map((word, index) => ({
    ...word,
    word: cleanupTextDeterministically(words[index] ?? word.word),
  }));
};

export const fallbackCleanupTranscript = (speech: TranscriptSpeechSegment[]) =>
  speech.map((segment) => ({
    ...segment,
    text: cleanupTextDeterministically(segment.text),
    words: mergeWords(segment),
  }));

const extractJsonPayload = (value: string) => {
  const fencedMatch = value.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1]!.trim();
  }

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1);
  }

  return value.trim();
};

const buildPrompt = (speech: TranscriptSpeechSegment[]) =>
  [
    'You clean Polish speech-to-text transcripts for short-form video editing.',
    'Return JSON only.',
    'Do not translate.',
    'Fix ASR errors, punctuation, casing, tool names, and obvious Polish grammar.',
    'Preserve meaning and segment order.',
    'If you change words[] length, omit words for that segment.',
    'JSON schema:',
    '{"segments":[{"index":0,"text":"...","words":["..."]}]}',
    JSON.stringify({
      segments: speech.map((segment, index) => ({
        index,
        text: segment.text,
        words: segment.words.map((word) => word.word),
      })),
    }),
  ].join('\n');

export const cleanTranscriptWithAi = async ({
  speech,
  apiKey,
  model = process.env.GEMINI_TRANSCRIPT_MODEL || DEFAULT_GEMINI_MODEL,
}: {
  speech: TranscriptSpeechSegment[];
  apiKey?: string;
  model?: string;
}) => {
  if (!apiKey) {
    return {
      provider: 'fallback' as const,
      model: 'deterministic-cleanup',
      cleanedSpeech: fallbackCleanupTranscript(speech),
      rawResponse: null,
    };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{text: buildPrompt(speech)}],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini cleanup failed: ${response.status} ${await response.text()}`);
    }

    const rawResponse = (await response.json()) as {
      candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>;
    };
    const text = rawResponse.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) {
      throw new Error('Gemini cleanup returned an empty response.');
    }

    const parsed = aiResponseSchema.parse(JSON.parse(extractJsonPayload(text)));
    const cleanedSpeech = speech.map((segment, index) => {
      const candidate = parsed.segments.find((item) => item.index === index);
      return {
        ...segment,
        text: cleanupTextDeterministically(candidate?.text ?? segment.text),
        words: mergeWords(segment, candidate?.words),
      };
    });

    return {
      provider: 'gemini' as const,
      model,
      cleanedSpeech,
      rawResponse,
    };
  } catch {
    return {
      provider: 'fallback' as const,
      model: 'deterministic-cleanup',
      cleanedSpeech: fallbackCleanupTranscript(speech),
      rawResponse: null,
    };
  }
};
