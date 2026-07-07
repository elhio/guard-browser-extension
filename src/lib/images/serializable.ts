import type { ImageCandidate } from './types';

/**
 * A lightweight representation of an image candidate safe for cross-context serialization
 */
export type SerializableImageCandidate = Omit<ImageCandidate, 'element'>;

/**
 * Strips non-serializable properties (like DOM elements) from an `ImageCandidate`
 *
 * @param candidate - The original, fully-populated image candidate containing a DOM reference
 * @returns A safe, serializable version of the candidate containing only primitive data (src, filename, extension, etc.)
 */
export function toSerializableCandidate(candidate: ImageCandidate): SerializableImageCandidate {
  const { element, ...rest } = candidate;
  return rest;
}