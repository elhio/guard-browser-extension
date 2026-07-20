import type { DetectionSignal, DetectionSignalMatch } from '@/lib/detection/types';

/**
 * Identifies the specific embedded metadata standard or file segment a signal is extracted from
 */
export type MetadataStandard = 'exif' | 'xmp' | 'iptc' | 'icc' | 'jfif' | 'ihdr';

/**
 * Represents a specialized detection rule applied to image metadata.
 *
 * @property standard - The metadata standard (e.g., 'exif', 'xmp') this signal belongs to
 * @property parameters - An array of the exact field or tag names this signal inspects, used for documentation and cataloging
 */
export interface MetadataSignal extends DetectionSignal {
  standard: MetadataStandard;
  parameters: readonly string[];
}

/**
 * Represents a successfully triggered metadata signal
 */
export type MetadataSignalMatch = MetadataSignal & DetectionSignalMatch;

/**
 * Represents the raw output of `exifr.parse()` when configured with `mergeOutput: false`
 *
 * Note: By keeping each metadata segment in its own distinct sub-object (rather than flattening them),
 * we ensure that each category detector is strictly isolated and only evaluates its intended slice of data.
 *
 * @property ifd0 - Primary image file directory data (often contains basic camera make/model).
 * @property exif - Exchangeable Image File Format data (camera settings, timestamps).
 * @property gps - Geolocation coordinate data.
 * @property xmp - Extensible Metadata Platform XML data (commonly holds AI generation tags).
 * @property icc - Color profile data.
 * @property iptc - International Press Telecommunications Council data (copyright, creator metadata).
 * @property jfif - JPEG File Interchange Format data.
 * @property ihdr - PNG Image Header data.
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

/**
 * A functional signature for a module that evaluates a specific metadata segment
 *
 * @param metadata - The full parsed raw image metadata object
 * @returns An array of successfully matched metadata signals
 */
export type MetadataSignalDetector = (metadata: RawImageMetadata) => MetadataSignalMatch[];