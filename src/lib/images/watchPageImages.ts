import { scanPageImages, type ScanPageImagesOptions } from './scanPageImages';
import type { ImageCandidate } from './types';

export interface WatchPageImagesOptions extends ScanPageImagesOptions {
  /** Called once for the initial scan, then again for every batch of newly discovered candidates. */
  onNewCandidates: (candidates: ImageCandidate[]) => void;
  /** Delay (ms) after the last DOM change before re-scanning. */
  debounceMs?: number;
}

/**
 * Scans the page for images, then keeps re-scanning whenever the DOM changes.
 *
 * Many pages (image search results, infinite-scroll feeds, social timelines)
 * render most of their images well after the initial page load — via
 * client-side JS, lazy-loading on scroll, or swapping a placeholder `src` for
 * the real one. A single one-shot scan misses all of that, so this observes
 * the DOM and re-scans, reporting only candidates not already reported.
 *
 * Returns a function that stops watching.
 */
export function watchPageImages(options: WatchPageImagesOptions): () => void {
  const { onNewCandidates, debounceMs = 500, ...scanOptions } = options;
  const reportedSrc = new Set<string>();

  function scanAndReportNew(): void {
    const candidates = scanPageImages(scanOptions);
    const newCandidates = candidates.filter((candidate) => !reportedSrc.has(candidate.src));
    if (newCandidates.length === 0) return;

    for (const candidate of newCandidates) reportedSrc.add(candidate.src);
    onNewCandidates(newCandidates);
  }

  scanAndReportNew();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndReportNew, debounceMs);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset']
  });

  return () => {
    observer.disconnect();
    clearTimeout(debounceTimer);
  };
}