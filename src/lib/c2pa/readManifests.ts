import { readManifestFor } from './readManifest';
import type { SerializableImageCandidate } from '@/lib/images';
import type { ImageAnalysisResult } from '@/lib/detection/types';

/**
 * Processes a batch of image candidates to extract their C2PA manifests and underlying metadata
 *
 * @param candidates - A read-only array of target images discovered on the host page
 * @returns A promise that resolves to an array of fully parsed results, preserving the exact order of the input array
 */
export async function readManifests(
  candidates: readonly SerializableImageCandidate[]
): Promise<ImageAnalysisResult[]> {
  return Promise.all(candidates.map(readManifestFor));
}