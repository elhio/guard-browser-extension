/**
 * Represents the DOM references required to safely manage a badge's lifecycle
 *
 * @property host - The encapsulated shadow DOM container holding the badge UI
 * @property target - The original `<img />` element the badge is attached to
 * @property wrapper - The `position: relative` `<div>` injected around the target
 */
interface TrackedBadge {
  host: HTMLElement;
  target: Element;
  wrapper: HTMLElement;
}

/**
 * How often (in milliseconds) to check for badges whose target image has disappeared
 *
 * Note: Cleanup is not time-critical. A lightweight periodic check is
 * used here instead of a `MutationObserver` to prevent performance degradation on
 * dynamic, DOM-heavy pages like infinite-scrolling social media feeds.
 */
const CLEANUP_INTERVAL_MS = 1000;

/** A global registry of all active badges on the page */
const trackedBadges = new Set<TrackedBadge>();

/** Holds the ID of the active polling timeout, or null if no badges are being tracked */
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Safely removes a specific badge and conditionally cleans up its wrapper
 *
 * @param entry - The tracking record for the badge to remove
 */
function removeBadge(entry: TrackedBadge): void {
  entry.host.remove();

  if (entry.wrapper.childElementCount === 0) {
    entry.wrapper.remove();
  }
}

/**
 * The core garbage collection loop
 */
function cleanupRemovedBadges(): void {
  for (const entry of trackedBadges) {
    // Drop entries whose host was already removed elsewhere (e.g., the feature was
    // globally toggled off), so the Set doesn't leak stale DOM references.
    if (!document.contains(entry.host)) {
      trackedBadges.delete(entry);
      continue;
    }

    // If the original image is still in the document, keep tracking it.
    if (document.contains(entry.target)) continue;

    // Otherwise, the image is gone. Clean up our injected UI.
    removeBadge(entry);
    trackedBadges.delete(entry);
  }

  // If there are still active badges, schedule the next cleanup cycle.
  // Otherwise, let the timer lapse to zero to save CPU cycles.
  cleanupTimer = trackedBadges.size > 0
    ? setTimeout(cleanupRemovedBadges, CLEANUP_INTERVAL_MS)
    : null;
}

/**
 * Registers a badge into the lifecycle management system
 *
 * @param host - The Shadow DOM host containing the badge
 * @param target - The original image element on the page
 * @param wrapper - The layout wrapper injected around the target
 */
export function trackBadge(host: HTMLElement, target: Element, wrapper: HTMLElement): void {
  trackedBadges.add({ host, target, wrapper });

  // Kick off the garbage collection loop if it isn't already running.
  if (cleanupTimer === null) {
    cleanupTimer = setTimeout(cleanupRemovedBadges, CLEANUP_INTERVAL_MS);
  }
}

/**
 * Forcefully removes every currently tracked badge from the page and halts the cleanup timer (for immediate cleanup)
 */
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