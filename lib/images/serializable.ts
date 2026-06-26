import type { ImageCandidate } from './types';

/** The subset of ImageCandidate that can be sent across the runtime messaging boundary (no DOM nodes). */
export type SerializableImageCandidate = Omit<ImageCandidate, 'element'>;

export function toSerializableCandidate(candidate: ImageCandidate): SerializableImageCandidate {
  const { element, ...rest } = candidate;
  return rest;
}
