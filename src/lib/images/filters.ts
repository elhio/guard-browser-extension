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

/**
 * Combines multiple independent filters into a single overarching filter
 *
 * @param filters - An array of `ImageFilter` functions to apply
 * @returns A single unified `ImageFilter` function that runs the full suite of checks
 */
export function combineFilters(filters: readonly ImageFilter[]): ImageFilter {
  return (candidate: ImageCandidate) => filters.every((filter) => filter(candidate));
}