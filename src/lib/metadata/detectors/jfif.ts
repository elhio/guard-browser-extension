import { METADATA_SIGNALS } from '../signals';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Evaluates the presence of the JFIF segment
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns An array containing the JFIF-present signal if the segment exists, or an empty array if not
 */
export function detectJfifSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  if (!metadata.jfif) return [];

  return [
    {
      ...METADATA_SIGNALS.jfifPresent,
      evidence: 'JFIF (APP0) segment present'
    }
  ];
}