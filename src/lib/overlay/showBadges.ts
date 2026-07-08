import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import type { ImageCandidate } from '@/lib/images';
import { isImageFlagged } from '@/lib/detection';
import { t } from '@/lib/i18n';
import { attachBadge } from './attachBadge';
import { markProcessing, setResult, setErrorState } from './store';

/** Marks a single image's ring + menu state as failed (transport/timeout errors). */
export function showBadgeError(src: string, element: HTMLImageElement, message: string): void {
  attachBadge(element, src).setStatus('error');
  setErrorState(src, element, message);
}

/**
 * Immediately attaches a spinning ring to newly discovered images and marks them processing.
 */
export function markBadgesProcessing(
  candidates: readonly ImageCandidate[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const candidate of candidates) {
    const element = elementsBySrc.get(candidate.src);
    if (!element) continue;
    attachBadge(element, candidate.src).setStatus('processing');
    markProcessing(candidate.src, element);
  }
}

/**
 * Applies a finished classification result to an image's ring and the shared menu store.
 * Verification is no longer triggered here — the menu starts it on demand.
 */
export function updateBadges(
  results: readonly ClassifyImageResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const result of results) {
    const element = elementsBySrc.get(result.src);
    if (!element) continue;

    const badge = attachBadge(element, result.src);

    if (result.status === 'error') {
      badge.setStatus('error');
      setErrorState(result.src, element, result.error || t('badge_error_analyze'));
      continue;
    }

    const isAlert = isImageFlagged(result.categories);
    badge.setStatus(isAlert ? 'alert' : 'idle');
    setResult(result.src, element, result, isAlert);
  }
}
