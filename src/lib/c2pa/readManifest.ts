import { getC2pa } from './client';
import { getManifestChain } from './manifestStore';
import { detectAiGeneration } from '@/lib/c2pa/aiDetection';
import { combineCategoryResults } from '@/lib/detection/combineResults';
import { extractImageMetadata, detectMetadataSignals } from '@/lib/metadata';
import type { SerializableImageCandidate } from '@/lib/images';
import type { ImageAnalysisResult } from '@/lib/detection/types';

/**
 * Evaluates an already-downloaded image blob for AI-generation, violent, and explicit signals using a dual-pass approach.
 *
 * Note: The caller downloads the image blob exactly once and passes the same buffer here (and to the local model),
 * so the extension never re-downloads an image it already has. This function feeds that one buffer to both the raw
 * metadata parser (EXIF/XMP/IPTC) and the WebAssembly C2PA manifest reader, and guarantees that the heavy WASM
 * `reader` instance is freed in a `finally` block to prevent memory leaks, even if manifest parsing throws.
 *
 * @param candidate - The image candidate (used for its `src`, echoed back in the result)
 * @param blob - The already-fetched image bytes to evaluate
 * @returns A promise resolving to an `ImageAnalysisResult` containing the combined detection results.
 */
export async function readManifestFor(
  candidate: SerializableImageCandidate,
  blob: Blob
): Promise<ImageAnalysisResult> {
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