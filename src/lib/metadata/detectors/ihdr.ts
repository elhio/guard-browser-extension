import { METADATA_SIGNALS } from '../signals';
import { looksLikeTypicalAiDimension } from '../terms/aiDimensions';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/** Detects AI-generation signals in the PNG IHDR chunk (width/height only — PNG has no software tag of its own). */
export function detectIhdrSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const ihdr = metadata.ihdr;
  if (!ihdr) return [];

  const width = ihdr.ImageWidth as number | undefined;
  const height = ihdr.ImageHeight as number | undefined;
  if (!looksLikeTypicalAiDimension(width, height)) return [];

  return [
    {
      ...METADATA_SIGNALS.ihdrTypicalAiDimension,
      evidence: `PNG dimensions ${width}x${height} match a common AI generator output size`
    }
  ];
}