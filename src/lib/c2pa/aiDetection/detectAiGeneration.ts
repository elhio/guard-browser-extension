import type { Manifest } from '@contentauth/c2pa-types';
import { AI_SIGNAL_DETECTORS } from './detectors';
import { AI_DETECTION_CONFIDENCE_THRESHOLD } from './signals';
import type { AiDetectionResult, AiSignalMatch } from './types';

/**
 * Runs every AI-generation signal detector against a chain of manifests
 * (the active manifest plus its ingredient chain — see getManifestChain)
 * and summarizes the result. Checking the whole chain matters because the
 * strongest signal (e.g. "created by an AI tool") often lives on an early
 * ingredient rather than the final, most-edited manifest.
 */
export function detectAiGeneration(manifests: readonly Manifest[]): AiDetectionResult {
  const matches: AiSignalMatch[] = manifests
    .flatMap((manifest) => AI_SIGNAL_DETECTORS.map((detect) => detect(manifest)))
    .filter((match): match is AiSignalMatch => match !== null)
    .sort((a, b) => b.confidence - a.confidence);

  const confidence = matches[0]?.confidence ?? 0;
  return {
    isLikelyAiGenerated: confidence >= AI_DETECTION_CONFIDENCE_THRESHOLD,
    confidence,
    matches
  };
}