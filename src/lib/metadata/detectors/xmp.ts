import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_VENDORS } from '@/lib/detection';
import { AI_SOURCE_TERMS } from '../terms/aiSourceTerms';
import { findMatchingTerm } from '../textMatch';
import { scanContentTerms } from './contentScan';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Evaluates the XMP segment for signals indicating AI generation.
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns An array of successfully matched metadata signals, populated with specific evidence strings
 */
export function detectXmpSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];
  if (!metadata.xmp) return matches;

  const generatorVendor = findMatchingTerm(metadata.xmp, AI_GENERATOR_VENDORS);
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

  matches.push(...scanContentTerms(metadata.xmp, METADATA_SIGNALS.xmpViolentContent, METADATA_SIGNALS.xmpExplicitContent));

  return matches;
}