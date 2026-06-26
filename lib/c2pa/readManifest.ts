import { getC2pa } from './client';
import type { C2paReadResult } from './types';
import type { ImageCandidate } from '../images/types';

/** Fetches a single image and reads its C2PA manifest store, if any. */
export async function readManifestFor(candidate: ImageCandidate): Promise<C2paReadResult> {
  try {
    const response = await fetch(candidate.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }
    const blob = await response.blob();

    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(blob.type, blob);
    if (!reader) {
      return { status: 'success', candidate, manifestStore: null };
    }
    try {
      const manifestStore = await reader.manifestStore();
      return { status: 'success', candidate, manifestStore };
    } finally {
      await reader.free();
    }
  } catch (error) {
    return {
      status: 'error',
      candidate,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
