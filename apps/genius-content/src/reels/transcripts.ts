import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {wordSchema, type Speech} from './model.js';
import {appRoot} from './files.js';

const transcriptSchema = z
  .object({
    speech: z
      .array(
        z.object({
          startMs: z.number().nonnegative(),
          endMs: z.number().nonnegative(),
          text: z.string(),
          words: z.array(wordSchema),
        }),
      )
      .min(1),
  })
  .refine((value) => value.speech.some((segment) => segment.words.length > 0));

export async function readTranscript(
  sourceId: string,
): Promise<Speech[] | null> {
  const libraryTranscripts = await readFile(
    path.join(appRoot, 'input/library-transcripts.json'), 'utf8',
  ).then(JSON.parse).catch(() => ({}));
  const bundled = (libraryTranscripts as Record<string, unknown>)[sourceId];
  const stored =
    bundled ??
    (await readFile(
      path.join(
        appRoot,
        'output/pipeline',
        sourceId,
        '00-transcript-clean.json',
      ),
      'utf8',
    ).then(JSON.parse).catch(() => null));
  const result = transcriptSchema.safeParse(stored);
  return result.success ? result.data.speech : null;
}
