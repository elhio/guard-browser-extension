import { getC2pa } from './client';
import { getManifestChain } from './manifestStore';
import { detectAiGeneration } from '@/lib/c2pa/aiDetection';
import { combineCategoryResults } from '@/lib/detection/combineResults';
import { extractImageMetadata, detectMetadataSignals } from '@/lib/metadata';
import type { SerializableImageCandidate } from '@/lib/images';
import type { ImageAnalysisResult } from '@/lib/detection/types';

/**
 * Fetches a target image and evaluates it for AI-generation signals using a dual-pass approach.
 *
 * Note: To minimize network overhead, this function fetches the image blob exactly once and passes the same buffer
 * to both the raw metadata parser (EXIF/XMP/IPTC) and the WebAssembly C2PA manifest reader. Additionally, it guarantees
 * that the heavy WASM `reader` instance is freed from memory in a `finally` block to prevent memory leaks, even if
 * manifest parsing throws an error.
 *
 * @param candidate - The image candidate object containing the `src` URL to fetch
 * @returns A promise resolving to an `ImageAnalysisResult` containing the combined detection results.
 */
export async function readManifestFor(candidate: SerializableImageCandidate): Promise<ImageAnalysisResult> {
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
        src: candidate.src,
        categories: {
          aiGenerated: combineCategoryResults('aiGenerated', [
            detectAiGeneration([]),
            metadataAiDetection
          ])
        }
      };
    }

    try {
      const manifestStore = await reader.manifestStore();
      const manifestChain = getManifestChain(manifestStore);

      return {
        src: candidate.src,
        categories: {
          aiGenerated: combineCategoryResults('aiGenerated', [
            detectAiGeneration(manifestChain),
            metadataAiDetection
          ])
        }
      };
    } finally {
      await reader.free();
    }
  } catch (error) {
    console.warn(`[Guard] Failed to parse metadata for ${candidate.src}:`, error);

    return {
      src: candidate.src,
      categories: {}
    };
  }
}