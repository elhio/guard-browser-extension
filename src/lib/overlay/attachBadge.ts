import { trackImage, type TrackedRing } from './badgeLayer';

/**
 * Attaches a status ring to an image (once) and returns its controller.
 *
 * This is a thin seam over `badgeLayer.trackImage`, kept so callers such as `showBadges` do not have
 * to know how rings are rendered. Registration is idempotent, so calling this repeatedly for the
 * same image — which `showBadges` does on every status change — is free.
 *
 * @param target - The image to badge
 * @param src - The image's source URL (used to key the shared menu's state)
 */
export function attachBadge(target: HTMLImageElement, src: string): TrackedRing {
  return trackImage(target, src);
}
