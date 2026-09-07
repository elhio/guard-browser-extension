import { scanPageImages, type ScanPageImagesOptions } from './scanPageImages';
import type { ImageCandidate } from './types';

/**
 * Configuration options for continuously monitoring a web page for new images
 *
 * @property onNewCandidates - Callback fired once for the initial scan, and subsequently for every batch of newly discovered image candidates
 * @property debounceMs - Delay (in milliseconds) to wait after the last DOM mutation before triggering a re-scan. Defaults to 500ms.
 */
export interface WatchPageImagesOptions extends ScanPageImagesOptions {
  onNewCandidates: (candidates: ImageCandidate[]) => void;
  debounceMs?: number;
}

/**
 * Scans the page for images, then continuously re-scans whenever the DOM changes
 *
 * Many modern web pages (e.g., image search results, infinite-scroll feeds, social timelines)
 * render most of their images well after the initial page load via client-side JavaScript,
 * lazy-loading on scroll, or by swapping a placeholder `src` for the real URL.
 * A single one-shot scan misses all of these late additions, so this function sets up a
 * `MutationObserver` to watch the DOM and re-scan, reporting only unique candidates
 * that haven't been processed yet.
 *
 * @param options - Configuration object containing scan filters, the reporting callback, and debounce timing
 * @returns A cleanup function that, when called, disconnects the observer and halts all further scanning
 */
export function watchPageImages(options: WatchPageImagesOptions): () => void {
  const { onNewCandidates, debounceMs = 500, ...scanOptions } = options;

  // Element to the URL it was last reported with, rather than a set of URLs
  const reported = new WeakMap<HTMLImageElement, string>();

  function scanAndReportNew(): void {
    const newCandidates: ImageCandidate[] = [];

    for (const candidate of scanPageImages(scanOptions)) {
      const fresh = candidate.elements.filter((element) => reported.get(element) !== candidate.src);
      if (fresh.length === 0) continue;

      for (const element of fresh) reported.set(element, candidate.src);

      // Narrowed to the unbadged elements so an already-classified copy is not reset to `processing`.
      candidate.elements = fresh;
      candidate.element = fresh[0];
      newCandidates.push(candidate);
    }

    if (newCandidates.length === 0) return;
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