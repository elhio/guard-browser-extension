import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_TERMS } from '../terms/aiGeneratorTerms';
import { AI_SOURCE_TERMS } from '../terms/aiSourceTerms';
import { findMatchingTerm } from '../textMatch';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Detects AI-generation signals in the XMP segment. XMP key casing/namespacing
 * varies a lot between tools, so unlike the EXIF detector this scans the whole
 * segment rather than picking exact field names — the `parameters` listed in
 * the signal catalog describe the fields of interest, not an exhaustive pick-list.
 */
export function detectXmpSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];
  if (!metadata.xmp) return matches;

  const generatorVendor = findMatchingTerm(metadata.xmp, AI_GENERATOR_TERMS);
  if (generatorVendor) {
    matches.push({
      ...METADATA_SIGNALS.xmpGeneratorVendor,
      evidence: `XMP metadata matches known AI vendor "${generatorVendor}"`
    });
  }

  const sourceTerm = findMatchingTerm(metadata.xmp, AI_SOURCE_TERMS);
  if (sourceTerm) {
    matches.push({
      ...METADATA_SIGNALS.xmpSourceTerms,
      evidence: `XMP metadata contains AI source/generation term "${sourceTerm}"`
    });
  }

  return matches;
}
