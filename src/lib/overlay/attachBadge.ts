import type { CategoryDetectionResult } from '@/lib/c2pa';
import type { ClassifyImageResponse } from '@/lib/messaging/modelMessages';
import { ensureBadgeWrapper } from './imageWrapper';
import { trackBadge } from './badgeLifecycle';
import { createBadgeElement } from './badgeElement';

const BADGE_MARKER_ATTRIBUTE = 'data-guard-badge-wrapper';
const BADGE_HOST_ATTRIBUTE = 'data-guard-badge-host';

/** Removes all badges from the page. */
export function clearAllBadges(): void {
  document.querySelectorAll(`[${BADGE_HOST_ATTRIBUTE}]`).forEach((host) => host.remove());
  document
    .querySelectorAll(`[${BADGE_MARKER_ATTRIBUTE}]`)
    .forEach((wrapper) => wrapper.removeAttribute(BADGE_MARKER_ATTRIBUTE));
}

/**
 * Attaches the interactive unified badge to an image.
 *
 * - If the image is already flagged as `isLikelyAiGenerated` from metadata,
 *   the badge is pinned (visible immediately) to warn the user.
 * - If the image is neutral or authentic, the badge only appears on hover
 *   so the page is not cluttered.
 *
 * Clicking the badge triggers the external API verification, permanently
 * pinning the badge to show the final result.
 */
export function attachBadge(
  target: HTMLImageElement,
  initialDetection: CategoryDetectionResult,
  analyze: () => Promise<ClassifyImageResponse>
): void {
  const wrapper = ensureBadgeWrapper(target);
  if (wrapper.hasAttribute(BADGE_MARKER_ATTRIBUTE)) return;

  wrapper.setAttribute(BADGE_MARKER_ATTRIBUTE, '');

  const badge = createBadgeElement();
  badge.host.setAttribute(BADGE_HOST_ATTRIBUTE, '');

  // Pin immediately if metadata strongly suggests AI, otherwise require hover
  let pinned = initialDetection.detected;
  badge.host.style.display = pinned ? '' : 'none';

  wrapper.append(badge.host);
  trackBadge(badge.host, target, wrapper);

  wrapper.addEventListener('mouseenter', () => {
    badge.host.style.display = '';
  });

  wrapper.addEventListener('mouseleave', () => {
    if (!pinned) badge.host.style.display = 'none';
  });

  function runAnalysis(): void {
    pinned = true; // Pin the badge permanently once analysis starts
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

  badge.showInitialState(initialDetection, runAnalysis);
}