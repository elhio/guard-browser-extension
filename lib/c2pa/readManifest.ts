import { getC2pa } from './client';
import { getManifestChain } from './manifestStore';
import { detectAiGeneration } from '@/lib/c2pa/aiDetection';
import { combineAiDetectionResults } from '@/lib/aiSignals';
import { extractImageMetadata, detectMetadataAiSignals } from '@/lib/metadata';
import type { C2paReadResult } from './types';
import type { ImageCandidate } from '@/lib/images';

/**
 * Fetches a single image and checks it for AI-generation hints from two
 * independent sources: its C2PA manifest (if any) and its embedded
 * EXIF/XMP/IPTC/ICC/JFIF/IHDR metadata. Both run against the same fetched
 * blob; their signals are merged by taking the strongest match overall.
 */
export async function readManifestFor(candidate: ImageCandidate): Promise<C2paReadResult> {
  try {
    const response = await fetch(candidate.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }
    const blob = await response.blob();

    const metadata = await extractImageMetadata(blob);
    const metadataAiDetection = detectMetadataAiSignals(metadata);

    const c2pa = await getC2pa();
    const reader = await c2pa.reader.fromBlob(blob.type, blob);
    if (!reader) {
      return {
        status: 'success',
        candidate,
        manifestStore: null,
        aiDetection: combineAiDetectionResults([detectAiGeneration([]), metadataAiDetection])
      };
    }
    try {
      const manifestStore = await reader.manifestStore();
      const manifestChain = getManifestChain(manifestStore);
      return {
        status: 'success',
        candidate,
        manifestStore,
        aiDetection: combineAiDetectionResults([detectAiGeneration(manifestChain), metadataAiDetection])
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
