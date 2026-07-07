import { ensureBadgeWrapper } from './imageWrapper';
import { trackBadge } from './badgeLifecycle';
import { createBadgeElement, type UnifiedBadge } from './badgeElement';

const BADGE_MARKER_ATTRIBUTE = 'data-guard-badge-wrapper';
const BADGE_HOST_ATTRIBUTE = 'data-guard-badge-host';

const activeBadges = new WeakMap<HTMLImageElement, UnifiedBadge>();

/** Removes all badges from the page. */
export function clearAllBadges(): void {
  document.querySelectorAll(`[${BADGE_HOST_ATTRIBUTE}]`).forEach((host) => host.remove());
  document
    .querySelectorAll(`[${BADGE_MARKER_ATTRIBUTE}]`)
    .forEach((wrapper) => wrapper.removeAttribute(BADGE_MARKER_ATTRIBUTE));
}

/**
 * Attaches a new badge to the DOM if one doesn't exist, and returns the
 * interactive controller to update its state.
 */
export function attachBadge(target: HTMLImageElement): UnifiedBadge {
  if (activeBadges.has(target)) {
    return activeBadges.get(target)!;
  }

  const wrapper = ensureBadgeWrapper(target);
  wrapper.setAttribute(BADGE_MARKER_ATTRIBUTE, '');

  const badge = createBadgeElement();
  badge.host.setAttribute(BADGE_HOST_ATTRIBUTE, '');

  wrapper.append(badge.host);
  trackBadge(badge.host, target, wrapper);

  activeBadges.set(target, badge);
  return badge;
}