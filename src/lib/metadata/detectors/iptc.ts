import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_TERMS } from '../terms/aiGeneratorTerms';
import { CAMERA_SOURCE_TERMS } from '../terms/aiSourceTerms';
import { findMatchingTerm } from '../textMatch';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/** Detects AI-generation (and camera-capture counter-) signals in the IPTC segment. */
export function detectIptcSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];
  if (!metadata.iptc) return matches;

  const generatorVendor = findMatchingTerm(metadata.iptc, AI_GENERATOR_TERMS);
  if (generatorVendor) {
    matches.push({
      ...METADATA_SIGNALS.iptcGeneratorVendor,
      evidence: `IPTC caption/credit fields match known AI vendor "${generatorVendor}"`
    });
  }

  const cameraTerm = findMatchingTerm(metadata.iptc, CAMERA_SOURCE_TERMS);
  if (cameraTerm) {
    matches.push({
      ...METADATA_SIGNALS.iptcCameraCapture,
      evidence: `IPTC source/credit field contains camera-capture wording "${cameraTerm}"`
    });
  }

  return matches;
}