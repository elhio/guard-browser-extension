import type { ImageCandidate, ImageFilter } from './types';

/**
 * Creates a filter that keeps only image candidates whose file extension matches certain allowed extensions
 *
 * @param allowed - An array of allowed file extension strings (e.g., `['jpg', 'png', 'webp']`)
 * @returns An `ImageFilter` function that evaluates a candidate
 */
export function byFileExtension(allowed: readonly string[]): ImageFilter {
  const normalized = new Set(allowed.map((ext) => ext.toLowerCase()));
  return (candidate: ImageCandidate) => normalized.has(candidate.fileExtension);
}

/**
 * Creates a filter that keeps only image candidates whose extracted file name matches certain regular expressions
 *
 * @param pattern - A RegExp object used to test against the candidate's file name
 * @returns An `ImageFilter` function that evaluates a candidate
 */
export function byFileName(pattern: RegExp): ImageFilter {
  return (candidate: ImageCandidate) => pattern.test(candidate.fileName);
}

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