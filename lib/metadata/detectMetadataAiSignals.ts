import { AI_DETECTION_CONFIDENCE_THRESHOLD } from '@/lib/aiSignals';
import { detectExifSignals } from './detectors/exif';
import { detectXmpSignals } from './detectors/xmp';
import { detectIptcSignals } from './detectors/iptc';
import { detectIccSignals } from './detectors/icc';
import { detectJfifSignals } from './detectors/jfif';
import { detectIhdrSignals } from './detectors/ihdr';
import type { MetadataSignalDetector, RawImageMetadata } from './types';
import type { AiDetectionResult } from '@/lib/aiSignals';

/** Called in this exact order — one detector per metadata format, each in its own file. */
const METADATA_SIGNAL_DETECTORS: readonly MetadataSignalDetector[] = [
  detectExifSignals,
  detectXmpSignals,
  detectIptcSignals,
  detectIccSignals,
  detectJfifSignals,
  detectIhdrSignals
];

/** Runs every metadata-format detector (EXIF, XMP, IPTC, ICC, JFIF, IHDR) against parsed image metadata, in order. */
export function detectMetadataAiSignals(metadata: RawImageMetadata): AiDetectionResult {
  const matches = METADATA_SIGNAL_DETECTORS.flatMap((detect) => detect(metadata)).sort(
    (a, b) => b.confidence - a.confidence
  );

  const confidence = matches[0]?.confidence ?? 0;
  return {
    isLikelyAiGenerated: confidence >= AI_DETECTION_CONFIDENCE_THRESHOLD,
    confidence,
    matches
  };
}
