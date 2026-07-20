import { METADATA_SIGNALS } from '../signals';
import { looksLikeTypicalAiDimension } from '../terms/aiDimensions';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Evaluates the IHDR chunk for structural signals that may indicate AI generation
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns An array of successfully matched metadata signals, populated with specific evidence strings
 */
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