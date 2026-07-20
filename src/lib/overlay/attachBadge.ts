import { ensureBadgeWrapper } from './imageWrapper';
import { trackBadge } from './badgeLifecycle';
import { createBadgeRing, type BadgeRing } from './badgeElement';

const activeBadges = new WeakMap<HTMLImageElement, BadgeRing>();

/**
 * Attaches a status ring to an image (once) and returns its controller.
 *
 * @param target - The image to badge
 * @param src - The image's source URL (used to key the shared menu's state)
 */
export function attachBadge(target: HTMLImageElement, src: string): BadgeRing {
  const existing = activeBadges.get(target);
  if (existing) return existing;

  const wrapper = ensureBadgeWrapper(target);
  const badge = createBadgeRing(src);

  wrapper.append(badge.host);
  trackBadge(badge.host, target, wrapper);

  activeBadges.set(target, badge);
  return badge;
}
