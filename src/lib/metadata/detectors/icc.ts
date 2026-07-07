import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_TERMS } from '../terms/aiGeneratorTerms';
import { findMatchingTerm } from '../textMatch';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Evaluates the ICC (International Color Consortium) color profile segment for signals indicating AI generation
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns An array of successfully matched metadata signals, populated with specific evidence strings
 */
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