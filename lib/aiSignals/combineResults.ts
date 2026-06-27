import { AI_DETECTION_CONFIDENCE_THRESHOLD } from './threshold';
import type { AiDetectionResult } from './types';

/** Merges several independent AI-detection results (e.g. from C2PA and embedded metadata) into one. */
export function combineAiDetectionResults(results: readonly AiDetectionResult[]): AiDetectionResult {
  const matches = results
    .flatMap((result) => result.matches)
    .sort((a, b) => b.confidence - a.confidence);

  const confidence = matches[0]?.confidence ?? 0;
  return {
    isLikelyAiGenerated: confidence >= AI_DETECTION_CONFIDENCE_THRESHOLD,
    confidence,
    matches
  };
}
