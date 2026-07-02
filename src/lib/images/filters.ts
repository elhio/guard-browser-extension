import type { ImageCandidate, ImageFilter } from './types';

/** Keeps only candidates whose extension is in the allow-list (case-insensitive). */
export function byFileExtension(allowed: readonly string[]): ImageFilter {
  const normalized = new Set(allowed.map((ext) => ext.toLowerCase()));
  return (candidate: ImageCandidate) => normalized.has(candidate.fileExtension);
}

/** Keeps only candidates whose file name matches the given pattern. */
export function byFileName(pattern: RegExp): ImageFilter {
  return (candidate: ImageCandidate) => pattern.test(candidate.fileName);
}

/** Drops candidates without a usable http(s) source, e.g. data: or blob: URLs. */
export function byHttpSource(): ImageFilter {
  return (candidate: ImageCandidate) => /^https?:\/\//i.test(candidate.src);
}

/** Combines filters; a candidate is kept only if every filter passes (logical AND). */
export function combineFilters(filters: readonly ImageFilter[]): ImageFilter {
  return (candidate: ImageCandidate) => filters.every((filter) => filter(candidate));
}