import { bucketMatchesByCategory } from '@/lib/detection/combineResults';
import type { ImageAnalysisResult } from '@/lib/detection/types';
import { detectExifSignals } from './detectors/exif';
import { detectXmpSignals } from './detectors/xmp';
import { detectIptcSignals } from './detectors/iptc';
import { detectIccSignals } from './detectors/icc';
import { detectJfifSignals } from './detectors/jfif';
import { detectIhdrSignals } from './detectors/ihdr';
import type { MetadataSignalDetector, RawImageMetadata } from './types';

/**
 * An ordered pipeline of metadata format detectors
 */
const METADATA_SIGNAL_DETECTORS: readonly MetadataSignalDetector[] = [
  detectExifSignals,
  detectXmpSignals,
  detectIptcSignals,
  detectIccSignals,
  detectJfifSignals,
  detectIhdrSignals
];

/**
 * Executes the full suite of metadata signal detectors against the parsed raw image metadata
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns The detected categories (aiGenerated / violent / explicit), each with its verdict,
 *          confidence, and supporting evidence. Categories with no matches are omitted.
 */
export function detectMetadataSignals(metadata: RawImageMetadata): ImageAnalysisResult['categories'] {
  // run all detectors and flatten their returned match arrays into a single list
  const matches = METADATA_SIGNAL_DETECTORS.flatMap((detect) => detect(metadata));

  // bucket the category-tagged matches into per-category results
  return bucketMatchesByCategory(matches);
}