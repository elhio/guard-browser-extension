import type {
  CategoryDetectionResult,
  DetectionSignalMatch,
  DetectionCategory,
  ImageAnalysisResult
} from './types';
import { passesThreshold } from './thresholds';

/**
 * The matched signals that point at the image being a genuine authentic capture
 * (Typically only applies to the 'aiGenerated' category)
 */
export function getAuthenticityMatches(result: CategoryDetectionResult): DetectionSignalMatch[] {
  return result.matches.filter((match) => match.kind === 'authentic');
}

/**
 * Whether the metadata contains positive evidence that the image is a real capture
 */
export function hasAuthenticityEvidence(result: CategoryDetectionResult): boolean {
  return getAuthenticityMatches(result).length > 0;
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
 * Pass image source and a raw array of all mixed signals found by your extractors and it will automatically output the
 * final payload
 */
export function buildImageAnalysis(src: string, allMatches: DetectionSignalMatch[]): ImageAnalysisResult {
  const categories: Record<DetectionCategory, CategoryDetectionResult> = {
    aiGenerated: { detected: false, confidence: 0, matches: [] },
    violent: { detected: false, confidence: 0, matches: [] },
    explicit: { detected: false, confidence: 0, matches: [] },
  };

  for (const match of allMatches) {
    categories[match.category].matches.push(match);
  }

  for (const cat of Object.keys(categories) as DetectionCategory[]) {
    const bucket = categories[cat];

    bucket.matches.sort((a, b) => b.confidence - a.confidence);
    bucket.confidence = bucket.matches[0]?.confidence ?? 0;
    bucket.detected = passesThreshold(cat, bucket.confidence);
  }

  return {
    src,
    categories
  };
}