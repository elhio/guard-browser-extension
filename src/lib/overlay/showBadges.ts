import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import type { VerifyImageResponse } from '@/lib/messaging/verifyMessages';
import type { ImageCandidate } from '@/lib/images';
import { attachBadge } from './attachBadge';
import { revealImage } from './applyAction';

/**
 * Immediately attaches a spinning badge to newly discovered images
 */
export function markBadgesProcessing(
  candidates: readonly ImageCandidate[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const candidate of candidates) {
    const element = elementsBySrc.get(candidate.src);
    if (element) {
      const badge = attachBadge(element);
      badge.setProcessing('Analyzing image...');
    }
  }
}

/**
 * Updates existing spinning badges with the final classification results
 */
export function updateBadges(
  results: readonly ClassifyImageResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>,
  verifyApiCallback?: (src: string) => Promise<VerifyImageResponse>
): void {
  for (const result of results) {
    const element = elementsBySrc.get(result.src);
    if (!element) continue;

    const badge = attachBadge(element);

    if (result.status === 'error') {
      badge.setError(result.error || 'Failed to analyze image');
      continue;
    }

    const isAlert =
      (result.categories.aiGenerated?.confidence ?? 0) > 50 ||
      (result.categories.violent?.confidence ?? 0) > 50 ||
      (result.categories.explicit?.confidence ?? 0) > 50;

    function runVerification(): void {
      if (!verifyApiCallback) return;
      badge.setVerificationPending();

      verifyApiCallback(result.src)
        .then((res) => {
          if (res.success) badge.setVerificationResult(res.data);
          else badge.setError(res.error);
        })
        .catch((err) => badge.setError(err.message || 'Verification failed'));
    }

    badge.setResult({
      result,
      isAlert,
      onVerify: verifyApiCallback ? runVerification : undefined,
      onReveal: () => revealImage(element)
    });
  }
}