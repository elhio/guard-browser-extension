import { ensureBadgeWrapper } from './imageWrapper';
import { trackBadge } from './badgeLifecycle';
import { createBadgeElement, type UnifiedBadge } from './badgeElement';

const activeBadges = new WeakMap<HTMLImageElement, UnifiedBadge>();

/**
 * Attaches a new badge to the DOM if one doesn't exist, and returns the
 * interactive controller to update its state.
 */
export function attachBadge(target: HTMLImageElement): UnifiedBadge {
  if (activeBadges.has(target)) {
    return activeBadges.get(target)!;
  }

  const wrapper = ensureBadgeWrapper(target);

  const badge = createBadgeElement();

  wrapper.append(badge.host);
  trackBadge(badge.host, target, wrapper);

  activeBadges.set(target, badge);
  return badge;
}