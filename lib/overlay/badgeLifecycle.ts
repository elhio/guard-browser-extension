interface TrackedBadge {
  host: HTMLElement;
  target: Element;
  wrapper: HTMLElement;
}

/** How often to check for badges whose target image has disappeared. Cleanup is not time-critical. */
const CLEANUP_INTERVAL_MS = 1000;

const trackedBadges = new Set<TrackedBadge>();
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function removeBadge(entry: TrackedBadge): void {
  entry.host.remove();
  // If the image itself is also gone from the wrapper (e.g. the page reparented
  // it elsewhere), drop our now-pointless wrapper too instead of leaving it behind.
  if (entry.wrapper.childElementCount === 0) {
    entry.wrapper.remove();
  }
}

function cleanupRemovedBadges(): void {
  for (const entry of trackedBadges) {
    if (document.contains(entry.target)) continue;
    removeBadge(entry);
    trackedBadges.delete(entry);
  }

  cleanupTimer = trackedBadges.size > 0 ? setTimeout(cleanupRemovedBadges, CLEANUP_INTERVAL_MS) : null;
}

/**
 * Registers a badge so it (and its wrapper, if left empty) gets removed once
 * its target image is no longer in the document. Starts a lightweight
 * periodic check on first use and stops it once no badges remain.
 */
export function trackBadge(host: HTMLElement, target: Element, wrapper: HTMLElement): void {
  trackedBadges.add({ host, target, wrapper });
  if (cleanupTimer === null) {
    cleanupTimer = setTimeout(cleanupRemovedBadges, CLEANUP_INTERVAL_MS);
  }
}

/** Removes every currently tracked badge from the page (e.g. when detection is turned off). */
export function clearAllBadges(): void {
  for (const entry of trackedBadges) {
    removeBadge(entry);
  }
  trackedBadges.clear();

  if (cleanupTimer !== null) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
}
