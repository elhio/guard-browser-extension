import { toImageCandidate } from './candidate';
import { combineFilters } from './filters';
import type { ImageCandidate, ImageFilter } from './types';

export interface ScanPageImagesOptions {
  /** Filters to apply; a candidate must pass all of them to be included. Defaults to none (all images). */
  filters?: readonly ImageFilter[];
  /** Document to scan. Defaults to the global `document` (useful for testing). */
  root?: Document | Element;
}

/**
 * Scans the page for <img> elements, turns each into an ImageCandidate,
 * de-duplicates by resolved src, and applies the provided filters.
 */
export function scanPageImages(options: ScanPageImagesOptions = {}): ImageCandidate[] {
  const { filters = [], root = document } = options;
  const passesFilters = combineFilters(filters);

  const elements = Array.from(root.querySelectorAll('img'));
  const seenSrc = new Set<string>();
  const candidates: ImageCandidate[] = [];

  for (const element of elements) {
    const src = element.currentSrc || element.src;
    if (!src || seenSrc.has(src)) continue;
    seenSrc.add(src);

    const candidate = toImageCandidate(src, element);
    if (passesFilters(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}