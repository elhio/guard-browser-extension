import type { ImageCandidate } from './types';

/**
 * A lightweight representation of an image candidate safe for cross-context serialization
 */
export type SerializableImageCandidate = Omit<ImageCandidate, 'element' | 'elements'>;

/**
 * Strips non-serializable properties (like DOM elements) from an `ImageCandidate`
 *
 * Every live-DOM field must be dropped here, not just `element`. Chrome's `runtime.sendMessage`
 * JSON-serializes and would quietly turn a stray node into `{}`, but Firefox and Safari structured-
 * clone and throw `DataCloneError: HTMLImageElement object could not be cloned`, which kills the
 * whole classify request before it leaves the content script.
 *
 * @param candidate - The original, fully-populated image candidate containing a DOM reference
 * @returns A safe, serializable version of the candidate containing only primitive data (src, filename, extension, etc.)
 */
export function toSerializableCandidate(candidate: ImageCandidate): SerializableImageCandidate {
  const { element, elements, ...rest } = candidate;
  return rest;
}