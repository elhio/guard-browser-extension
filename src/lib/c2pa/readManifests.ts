import { readManifestFor } from './readManifest';
import type { C2paReadResult } from './types';
import type { ImageCandidate } from '@/lib/images';

/** Reads C2PA manifests for a list of image candidates, one request per image, in parallel. */
export async function readManifests(
  candidates: readonly ImageCandidate[]
): Promise<C2paReadResult[]> {
  return Promise.all(candidates.map(readManifestFor));
}