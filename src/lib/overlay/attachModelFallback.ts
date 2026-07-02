import type { ClassifyImageResponse } from '@/lib/messaging/modelMessages';
import type { AiSignalMatch } from '@/lib/aiSignals';
import { ensureBadgeWrapper } from './imageWrapper';
import { trackBadge } from './badgeLifecycle';
import { createModelFallbackBadge } from './modelFallbackElement';

const FALLBACK_MARKER_ATTRIBUTE = 'data-guard-analyze';
const FALLBACK_HOST_ATTRIBUTE = 'data-guard-fallback-host';

/** Removes all local-model fallback badges from the page (e.g. when the option is toggled off). */
export function clearModelFallback(): void {
  document.querySelectorAll(`[${FALLBACK_HOST_ATTRIBUTE}]`).forEach((host) => host.remove());
  // Drop the wrapper markers so the fallback can be re-attached later if re-enabled.
  document
    .querySelectorAll(`[${FALLBACK_MARKER_ATTRIBUTE}]`)
    .forEach((wrapper) => wrapper.removeAttribute(FALLBACK_MARKER_ATTRIBUTE));
}

/**
 * Adds a local-model fallback affordance to an image the automatic detection
 * did NOT flag as AI. A badge appears while the user hovers the image (so pages
 * full of undetected images don't get cluttered):
 *
 * - If the metadata positively indicates a genuine capture (`authenticityEvidence`
 *   non-empty), the badge says so ("Metadaten: echtes Bild") — but stays clickable
 *   so the user can still run the model for a second opinion.
 * - Otherwise it's the neutral "🔍 Mit KI prüfen" button.
 *
 * Clicking runs `analyze` (the local model via background/offscreen) and re-renders
 * the badge in place with the verdict, which then stays visible.
 *
 * `analyze` is injected so this overlay code stays free of messaging concerns.
 */
export function attachModelFallback(
  target: HTMLImageElement,
  analyze: () => Promise<ClassifyImageResponse>,
  authenticityEvidence: readonly AiSignalMatch[] = []
): void {
  const wrapper = ensureBadgeWrapper(target);
  if (wrapper.hasAttribute(FALLBACK_MARKER_ATTRIBUTE)) return; // already attached
  wrapper.setAttribute(FALLBACK_MARKER_ATTRIBUTE, '');

  const badge = createModelFallbackBadge();
  badge.host.setAttribute(FALLBACK_HOST_ATTRIBUTE, '');
  badge.host.style.display = 'none';
  wrapper.append(badge.host);
  trackBadge(badge.host, target, wrapper);

  // Once the user has triggered an analysis, keep the badge visible regardless
  // of hover so the verdict doesn't vanish when the pointer leaves.
  let pinned = false;

  wrapper.addEventListener('mouseenter', () => {
    badge.host.style.display = '';
  });
  wrapper.addEventListener('mouseleave', () => {
    if (!pinned) badge.host.style.display = 'none';
  });

  function runAnalysis(): void {
    pinned = true;
    badge.showPending();
    analyze()
      .then(({ aiScore, error }) => {
        if (error || aiScore === null) {
          badge.showError();
        } else {
          badge.showResult(aiScore);
        }
      })
      .catch(() => badge.showError());
  }

  if (authenticityEvidence.length > 0) {
    const tooltip = authenticityEvidence.map((match) => `${match.label}: ${match.evidence}`).join('\n');
    badge.showAuthenticButton(runAnalysis, tooltip);
  } else {
    badge.showAnalyzeButton(runAnalysis);
  }
}