import type { Manifest } from '@contentauth/c2pa-types';
import { AI_SIGNAL_DETECTORS } from './detectors';
import { passesThreshold } from '@/lib/detection';
import type { CategoryDetectionResult, DetectionSignalMatch } from './types';

/**
 * Evaluates a chain of C2PA manifests for signals indicating AI generation
 *
 * Note: This function runs every registered AI-generation signal detector against both the active manifest and its
 * historical ingredient chain. This deep traversal is critical because the strongest indicators of AI origin
 * (e.g., a "created by an AI tool" action) are often recorded in the initial creation ingredient rather than the final,
 * post-edited manifest.
 *
 * @param manifests - An array of C2PA manifests representing the asset's history
 * @returns A summarized detection result containing a boolean flag indicating if AI was detected, the highest
 * confidence score, and a sorted array of all matched signals
 */
export function detectAiGeneration(manifests: readonly Manifest[]): CategoryDetectionResult {
  const matches: DetectionSignalMatch[] = manifests
    .flatMap((manifest) => AI_SIGNAL_DETECTORS.map((detect) => detect(manifest)))
    .filter((match): match is DetectionSignalMatch => match !== null)
    .sort((a, b) => b.confidence - a.confidence);

  const confidence = matches[0]?.confidence ?? 0;
  return {
    detected: passesThreshold('aiGenerated', confidence),
    confidence,
    matches
  };
}