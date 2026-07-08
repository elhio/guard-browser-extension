import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_VENDORS } from '@/lib/detection';
import { CAMERA_SOURCE_TERMS } from '../terms/aiSourceTerms';
import { findMatchingTerm } from '../textMatch';
import { scanContentTerms } from './contentScan';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Evaluates the IPTC metadata segment for signals indicating either AI generation or authentic camera capture
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns An array of successfully matched metadata signals, populated with specific evidence strings
 */
export function detectIptcSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];
  if (!metadata.iptc) return matches;

  const generatorVendor = findMatchingTerm(metadata.iptc, AI_GENERATOR_VENDORS);
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

  matches.push(...scanContentTerms(metadata.iptc, METADATA_SIGNALS.iptcViolentContent, METADATA_SIGNALS.iptcExplicitContent));

  return matches;
}