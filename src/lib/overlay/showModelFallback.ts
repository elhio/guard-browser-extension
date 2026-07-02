import type { C2paReadResult } from '@/lib/c2pa';
import type { ClassifyImageResponse } from '@/lib/messaging/modelMessages';
import { getAuthenticityMatches } from '@/lib/aiSignals';
import { attachModelFallback } from './attachModelFallback';

/**
 * For every successfully scanned image that the automatic detection did NOT
 * flag as AI-generated, offers a local-model fallback button (see
 * attachModelFallback). Images that errored, or were already flagged as AI,
 * are skipped — they don't need a second opinion.
 *
 * `classify` is injected (content script -> background -> offscreen model).
 */
export function showModelFallback(
  results: readonly C2paReadResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>,
  classify: (src: string) => Promise<ClassifyImageResponse>
): void {
  for (const result of results) {
    if (result.status !== 'success' || result.aiDetection.isLikelyAiGenerated) continue;

    const element = elementsBySrc.get(result.candidate.src);
    if (element) {
      const authenticityEvidence = getAuthenticityMatches(result.aiDetection);
      attachModelFallback(element, () => classify(result.candidate.src), authenticityEvidence);
    }
  }
}