import { METADATA_SIGNALS } from '../signals';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * JFIF (the JPEG APP0 segment) carries no AI-relevant information by itself —
 * it's present in most baseline JPEGs regardless of origin. Its only modest
 * use here is as a very weak "looks like a standard JPEG encoder" data point.
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
