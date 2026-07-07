import { getC2pa } from './client';
import { getManifestChain } from './manifestStore';
import { detectAiGeneration } from '@/lib/c2pa/aiDetection';
import { combineCategoryResults } from '@/lib/detection/combineResults';
import { extractImageMetadata, detectMetadataSignals } from '@/lib/metadata';
import type { C2paReadResult } from './types';
import type { ImageCandidate } from '@/lib/images';

/**
 * Fetches a target image and evaluates it for AI-generation signals using a dual-pass approach.
 *
 * Note: To minimize network overhead, this function fetches the image blob exactly once and passes the same buffer
 * to both the raw metadata parser (EXIF/XMP/IPTC) and the WebAssembly C2PA manifest reader. Additionally, it guarantees
 * that the heavy WASM `reader` instance is freed from memory in a `finally` block to prevent memory leaks, even if
 * manifest parsing throws an error.
 *
 * @param candidate - The image candidate object containing the `src` URL to fetch
 * @returns A promise resolving to a `C2paReadResult`. On success, it contains the combined detection results.
 */
export async function readManifestFor(candidate: ImageCandidate): Promise<C2paReadResult> {
  try {
    const response = await fetch(candidate.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }
    const blob = await response.blob();

    const metadata = await extractImageMetadata(blob);
    const metadataAiDetection = detectMetadataSignals(metadata);

    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(blob.type, blob);

    if (!reader) {
      return {
        status: 'success',
        candidate,
        manifestStore: null,
        aiDetection: combineCategoryResults('aiGenerated', [detectAiGeneration([]), metadataAiDetection])
      };
    }

    try {
      const manifestStore = await reader.manifestStore();
      const manifestChain = getManifestChain(manifestStore);

      return {
        status: 'success',
        candidate,
        manifestStore,
        aiDetection: combineCategoryResults('aiGenerated', [detectAiGeneration(manifestChain), metadataAiDetection])
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