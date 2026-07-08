import { getC2pa } from './client';
import { getManifestChain } from './manifestStore';
import { detectAiGeneration } from '@/lib/c2pa/aiDetection';
import { combineCategoryResults } from '@/lib/detection/combineResults';
import { extractImageMetadata, detectMetadataSignals } from '@/lib/metadata';
import { fetchWithTimeout } from '@/lib/net/fetchWithTimeout';
import type { SerializableImageCandidate } from '@/lib/images';
import type { ImageAnalysisResult } from '@/lib/detection/types';

/** How long to wait for an image download before treating it as failed. */
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches a target image and evaluates it for AI-generation, violent, and explicit signals using a dual-pass approach.
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
  // A fetch failure or timeout is a genuine failure — let it throw so the caller
  // can mark this one badge as failed (gray), without affecting any other image.
  const response = await fetchWithTimeout(candidate.src, IMAGE_FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }
  const blob = await response.blob();

  // Metadata scan populates every category it finds evidence for (AI, violent, explicit).
  // extractImageMetadata is resilient: unsupported formats (e.g. WebP) simply yield no metadata.
  const metaCategories = detectMetadataSignals(await extractImageMetadata(blob));

  // The C2PA manifest layer only ever contributes AI-generation evidence, and is optional:
  // an unreadable/unsupported container must NOT discard the metadata results above.
  let aiFromC2pa = detectAiGeneration([]);
  try {
    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(blob.type, blob);
    if (reader) {
      try {
        aiFromC2pa = detectAiGeneration(getManifestChain(await reader.manifestStore()));
      } finally {
        await reader.free();
      }
    }
  } catch {
    // No / unreadable C2PA manifest for this format — ignore and keep the metadata results.
  }

  // Merge the C2PA and metadata AI evidence; violent/explicit come from metadata alone.
  const aiSources = [aiFromC2pa];
  if (metaCategories.aiGenerated) aiSources.push(metaCategories.aiGenerated);

  return {
    src: candidate.src,
    categories: {
      ...metaCategories,
      aiGenerated: combineCategoryResults('aiGenerated', aiSources)
    }
  };
}