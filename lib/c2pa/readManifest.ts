import { getC2pa } from './client';
import { getManifestChain } from './manifestStore';
import { detectAiGeneration } from './aiDetection/detectAiGeneration';
import type { C2paReadResult } from './types';
import type { ImageCandidate } from '../images/types';

/** Fetches a single image, reads its C2PA manifest store, and checks it for AI-generation hints. */
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
      return {
        status: 'success',
        candidate,
        manifestStore: null,
        aiDetection: detectAiGeneration([])
      };
    }
    try {
      const manifestStore = await reader.manifestStore();
      const manifestChain = getManifestChain(manifestStore);
      return {
        status: 'success',
        candidate,
        manifestStore,
        aiDetection: detectAiGeneration(manifestChain)
      };
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
