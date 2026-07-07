import { passesThreshold } from '@/lib/detection/thresholds';
import type { CategoryDetectionResult } from '@/lib/detection/types';
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
 * @returns A structured category result containing the detection verdict, maximum confidence, and all supporting evidence
 */
export function detectMetadataSignals(metadata: RawImageMetadata): CategoryDetectionResult {
  // run all detectors and flatten their returned match arrays into a single list
  const matches = METADATA_SIGNAL_DETECTORS
    .flatMap((detect) => detect(metadata))
    .sort((a, b) => b.confidence - a.confidence);

  // overall confidence is simply the highest confidence among all matched signals
  const confidence = matches[0]?.confidence ?? 0;

  // return the generic CategoryDetectionResult shape
  return {
    detected: passesThreshold('aiGenerated', confidence),
    confidence,
    matches
  };
}