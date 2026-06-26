import { positionBadgeOverElement } from './positionBadge';

interface TrackedBadge {
  host: HTMLElement;
  target: Element;
}

const trackedBadges = new Set<TrackedBadge>();
let animationFrameId: number | null = null;

function tick(): void {
  for (const entry of trackedBadges) {
    if (!document.contains(entry.target)) {
      entry.host.remove();
      trackedBadges.delete(entry);
      continue;
    }
    positionBadgeOverElement(entry.host, entry.target);
  }

  animationFrameId = trackedBadges.size > 0 ? requestAnimationFrame(tick) : null;
}

/**
 * Registers a badge to be kept positioned over its target element every frame,
 * and automatically removed once the target is no longer in the document
 * (e.g. the page replaced/removed the image). Starts a shared rAF loop on
 * first use and stops it once no badges remain.
 */
export function trackBadge(host: HTMLElement, target: Element): void {
  trackedBadges.add({ host, target });
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(tick);
  }
}
