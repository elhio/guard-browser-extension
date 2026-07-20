import type {
  CategoryDetectionResult,
  DetectionCategory,
  DetectionSignalMatch,
  ImageAnalysisResult
} from './types';
import { passesThreshold } from './thresholds';

/**
 * Buckets a flat list of category-tagged signal matches into per-category results.
 *
 * Only categories that actually have a match appear in the returned object. Within
 * each category the matches are sorted by confidence, the overall confidence is the
 * highest match, and `detected` is decided by that category's threshold.
 */
export function bucketMatchesByCategory(
  matches: readonly DetectionSignalMatch[]
): ImageAnalysisResult['categories'] {
  const categories: ImageAnalysisResult['categories'] = {};

  for (const match of matches) {
    (categories[match.category] ??= { detected: false, confidence: 0, matches: [] }).matches.push(match);
  }

  for (const category of Object.keys(categories) as DetectionCategory[]) {
    const bucket = categories[category]!;
    bucket.matches.sort((a, b) => b.confidence - a.confidence);
    bucket.confidence = bucket.matches[0]?.confidence ?? 0;
    bucket.detected = passesThreshold(category, bucket.confidence);
  }

  return categories;
}

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