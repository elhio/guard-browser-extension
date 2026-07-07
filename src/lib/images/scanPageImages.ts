import { toImageCandidate } from './candidate';
import { combineFilters } from './filters';
import type { ImageCandidate, ImageFilter } from './types';

/**
 * Configuration options for scanning a DOM tree for image elements
 *
 * @property filters - An optional array of `ImageFilter` functions. A candidate must pass *all* of them to be included. Defaults to an empty array (allows all images).
 * @property root - The DOM `Document` or `Element` to scan within. Defaults to the global `document` (can be overridden for isolated testing or scoped scanning).
 */
export interface ScanPageImagesOptions {
  filters?: readonly ImageFilter[];
  root?: Document | Element;
}

/**
 * Scans the specified DOM tree for `<img>` elements, converts each into an `ImageCandidate`, de-duplicates them based on their resolved source URL, and applies the provided filters.
 *
 * @param options - Configuration options dictating the root element to scan and the filters to apply
 * @returns An array of unique, filtered `ImageCandidate` objects found within the target root
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