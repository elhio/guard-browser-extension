import type { ImageCandidate, ImageFilter } from './types';

/**
 * Creates a filter that ensures image candidates have a valid, routable HTTP or HTTPS source URL, which
 * effectively drops inline `data:` URIs, `blob:` URIs, or local file paths
 *
 * * @returns An `ImageFilter` function that evaluates a candidate.
 */
export function byHttpSource(): ImageFilter {
  return (candidate: ImageCandidate) => /^https?:\/\//i.test(candidate.src);
}

/** File extensions the detector skips: vector graphics and icons carry no photographic content. */
const UNSUPPORTED_EXTENSIONS = new Set(['svg', 'ico']);

/**
 * Creates a filter that drops non-photographic formats (SVG, ICO) by file extension, keeping every
 * raster format (and extensionless URLs). SVGs also can't be rasterized by `createImageBitmap` on
 * Firefox, so this avoids that failure at the source. Rasterized thumbnails such as
 * `.../X.svg/240px-X.svg.png` keep their `png` extension and are retained.
 *
 * @returns An `ImageFilter` that rejects candidates whose extension is a known non-raster format.
 */
export function bySupportedFormat(): ImageFilter {
  return (candidate: ImageCandidate) => !UNSUPPORTED_EXTENSIONS.has(candidate.fileExtension);
}

/**
 * Creates a filter that drops images too small to perceive (icons, bullets, spacers, tracking
 * pixels). It measures the on-screen (rendered) size, falling back to the intrinsic size, and keeps
 * anything not yet measurable (e.g. lazy-loaded images with no layout yet) so nothing is dropped
 * prematurely.
 *
 * @param minPx - Minimum size, in CSS pixels, required on the image's larger side.
 * @returns An `ImageFilter` that rejects candidates smaller than `minPx`.
 */
export function byMinRenderedSize(minPx: number): ImageFilter {
  return ({ element }: ImageCandidate) => {
    if (!element) return true;
    const { width, height } = element.getBoundingClientRect();
    const rendered = Math.max(width, height);
    const natural = Math.max(element.naturalWidth, element.naturalHeight);
    const size = rendered || natural;
    // Keep when unmeasurable (0 → not laid out / not loaded yet) or large enough to matter.
    return size === 0 || size >= minPx;
  };
}

/**
 * Combines multiple independent filters into a single overarching filter
 *
 * @param filters - An array of `ImageFilter` functions to apply
 * @returns A single unified `ImageFilter` function that runs the full suite of checks
 */
export function combineFilters(filters: readonly ImageFilter[]): ImageFilter {
  return (candidate: ImageCandidate) => filters.every((filter) => filter(candidate));
}