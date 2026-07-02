import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_TERMS } from '../terms/aiGeneratorTerms';
import { findMatchingTerm } from '../textMatch';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/** Detects AI-generation signals in the ICC color profile segment (rare, but some exporters embed tool names). */
export function detectIccSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];
  if (!metadata.icc) return matches;

  const vendor = findMatchingTerm(metadata.icc, AI_GENERATOR_TERMS);
  if (vendor) {
    matches.push({
      ...METADATA_SIGNALS.iccVendorProfile,
      evidence: `ICC profile description matches known AI vendor "${vendor}"`
    });
  }

  return matches;
}