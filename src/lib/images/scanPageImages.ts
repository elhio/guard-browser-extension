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
 * Scans the specified DOM tree for `<img>` elements, converts each into an `ImageCandidate`, groups them
 * by their resolved source URL, and applies the provided filters.
 *
 * One candidate is produced per distinct URL, so a URL is still classified exactly once, but the
 * candidate carries every element showing it in `elements` so each of them can be badged. A repeated
 * element only needs to pass the filters on its own account to join the group — the size filter in
 * particular is per-element, since the same URL can be a thumbnail in one place and a hero in another.
 *
 * @param options - Configuration options dictating the root element to scan and the filters to apply
 * @returns An array of filtered `ImageCandidate` objects, one per distinct URL within the target root
 */
export function scanPageImages(options: ScanPageImagesOptions = {}): ImageCandidate[] {
  const { filters = [], root = document } = options;
  const passesFilters = combineFilters(filters);

  const elements = Array.from(root.querySelectorAll('img'));
  const bySrc = new Map<string, ImageCandidate>();
  const candidates: ImageCandidate[] = [];

  for (const element of elements) {
    const src = element.currentSrc || element.src;
    if (!src) continue;

    const candidate = toImageCandidate(src, element);
    if (!passesFilters(candidate)) continue;

    const existing = bySrc.get(src);
    if (existing) {
      existing.elements.push(element);
      continue;
    }

    bySrc.set(src, candidate);
    candidates.push(candidate);
  }

  return candidates;
}