import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import type { VerifyImageResponse } from '@/lib/messaging/verifyMessages';
import type { ImageCandidate } from '@/lib/images';
import { isImageFlagged } from '@/lib/detection';
import { t } from '@/lib/i18n';
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
      badge.setProcessing(t('badge_processing'));
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
      badge.setError(result.error || t('badge_error_analyze'));
      continue;
    }

    const isAlert = isImageFlagged(result.categories);

    function runVerification(): void {
      if (!verifyApiCallback) return;
      badge.setVerificationPending();

      verifyApiCallback(result.src)
        .then((res) => {
          if (res.success) badge.setVerificationResult(res.data);
          else badge.setError(res.error);
        })
        .catch((err) => badge.setError(err.message || t('badge_error_verify')));
    }

    badge.setResult({
      result,
      isAlert,
      onVerify: verifyApiCallback ? runVerification : undefined,
      onReveal: () => revealImage(element)
    });
  }
}