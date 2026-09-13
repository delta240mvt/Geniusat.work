import {createEmptyAnalysisDocument, type NormalizedAnalysis} from '../types/analysis.js';

type GoogleAnnotationResponse = {
  annotationResults?: Array<{
    segment?: {endTimeOffset?: string};
    shotAnnotations?: Array<{
      startTimeOffset?: string;
      endTimeOffset?: string;
    }>;
    segmentLabelAnnotations?: Array<{
      entity?: {description?: string};
      segments?: Array<{
        confidence?: number;
      }>;
    }>;
    objectAnnotations?: Array<{
      entity?: {description?: string};
      confidence?: number;
      segment?: {
        startTimeOffset?: string;
        endTimeOffset?: string;
      };
    }>;
    textAnnotations?: Array<{
      text?: string;
    }>;
    speechTranscriptions?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{
          startTime?: string;
          endTime?: string;
          word?: string;
        }>;
      }>;
    }>;
    faceDetectionAnnotations?: Array<{
      tracks?: Array<{
        segment?: {
          startTimeOffset?: string;
          endTimeOffset?: string;
        };
        timestampedObjects?: Array<{
          attributes?: Array<{
            name?: string;
          }>;
        }>;
      }>;
    }>;
  }>;
};

const parseOffset = (value?: string) => {
  if (!value) {
    return 0;
  }

  return Math.round(Number.parseFloat(value.replace('s', '')) * 1000);
};

export const normalizeAnalysis = (
  rawGoogleResponse: GoogleAnnotationResponse,
  research: Array<{title: string; snippet: string; sourceUrl?: string}>,
  sourceVideo: string,
  videoId: string,
): NormalizedAnalysis => {
  const result = rawGoogleResponse.annotationResults?.[0];
  const durationMs = parseOffset(result?.segment?.endTimeOffset);
  const doc = createEmptyAnalysisDocument(sourceVideo, videoId, durationMs);

  doc.shots =
    result?.shotAnnotations?.map((shot) => ({
      startMs: parseOffset(shot.startTimeOffset),
      endMs: parseOffset(shot.endTimeOffset),
    })) ?? [];

  doc.labels =
    result?.segmentLabelAnnotations?.map((label) => ({
      description: label.entity?.description ?? 'unknown',
      confidence: label.segments?.[0]?.confidence ?? 0,
    })) ?? [];

  doc.objects =
    result?.objectAnnotations?.map((object) => ({
      name: object.entity?.description ?? 'unknown',
      confidence: object.confidence ?? 0,
      startMs: parseOffset(object.segment?.startTimeOffset),
      endMs: parseOffset(object.segment?.endTimeOffset),
    })) ?? [];

  doc.textDetections = result?.textAnnotations?.map((text) => text.text ?? '').filter(Boolean) ?? [];

  doc.speech =
    result?.speechTranscriptions
      ?.map((entry) => {
        const alternative = entry.alternatives?.[0];
        const words =
          alternative?.words?.map((wordInfo) => ({
            startMs: parseOffset(wordInfo.startTime),
            endMs: parseOffset(wordInfo.endTime),
            word: wordInfo.word ?? '',
          })) ?? [];
        return {
          startMs: words[0]?.startMs ?? 0,
          endMs: words.at(-1)?.endMs ?? words[0]?.endMs ?? 0,
          text: alternative?.transcript ?? '',
          confidence: alternative?.confidence,
          words: words.filter((word) => word.word),
        };
      })
      .filter((entry) => entry.text) ?? [];

  doc.faceDetections =
    result?.faceDetectionAnnotations?.flatMap((annotation) =>
      (annotation.tracks ?? []).map((track) => ({
        startMs: parseOffset(track.segment?.startTimeOffset),
        endMs: parseOffset(track.segment?.endTimeOffset),
        attributes:
          track.timestampedObjects?.[0]?.attributes?.map((attribute) => attribute.name ?? '').filter(Boolean) ?? [],
      })),
    ) ?? [];

  doc.research = research;

  return doc;
};
