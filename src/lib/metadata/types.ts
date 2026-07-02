import type { AiSignal, AiSignalMatch } from '@/lib/aiSignals';

/** Which embedded-metadata format a signal is read from. */
export type MetadataCategory = 'exif' | 'xmp' | 'iptc' | 'icc' | 'jfif' | 'ihdr';

export interface MetadataSignal extends AiSignal {
  category: MetadataCategory;
  /** The actual field names this signal inspects, for documentation/overview purposes. */
  parameters: readonly string[];
}

export type MetadataSignalMatch = MetadataSignal & AiSignalMatch;

/**
 * Raw output of `exifr.parse()` with `mergeOutput: false` — one sub-object
 * per metadata segment instead of a single flattened bag of fields, so each
 * category detector only ever looks at its own slice.
 */
export interface RawImageMetadata {
  ifd0?: Record<string, unknown>;
  exif?: Record<string, unknown>;
  gps?: Record<string, unknown>;
  xmp?: Record<string, unknown>;
  icc?: Record<string, unknown>;
  iptc?: Record<string, unknown>;
  jfif?: Record<string, unknown>;
  ihdr?: Record<string, unknown>;
  [key: string]: unknown;
}

export type MetadataSignalDetector = (metadata: RawImageMetadata) => MetadataSignalMatch[];