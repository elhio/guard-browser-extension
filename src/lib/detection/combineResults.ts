import type {
  CategoryDetectionResult,
  DetectionCategory,
  ImageAnalysisResult
} from './types';
import { passesThreshold } from './thresholds';

/**
 * Merges several independent results for a single category into one final result
 */
export function combineCategoryResults(
  category: DetectionCategory,
  results: readonly CategoryDetectionResult[]
): CategoryDetectionResult {
  const matches = results
    .flatMap((result) => result.matches)
    .sort((a, b) => b.confidence - a.confidence);

  const confidence = matches[0]?.confidence ?? 0;

  return {
    detected: passesThreshold(category, confidence),
    confidence,
    matches
  };
}

/**
 * Whether an image should be flagged: true if any evaluated category crossed its
 * detection threshold (`DETECTION_THRESHOLDS` via `combineCategoryResults`).
 */
export function isImageFlagged(categories: ImageAnalysisResult['categories']): boolean {
  return Object.values(categories).some((category) => category?.detected === true);
}