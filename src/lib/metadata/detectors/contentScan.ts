import { findMatchingTerm } from '../textMatch';
import { VIOLENCE_TERMS, EXPLICIT_TERMS } from '../terms/contentTerms';
import type { MetadataSignal, MetadataSignalMatch } from '../types';

/**
 * Scans a metadata segment for violent / explicit content wording and returns the
 * matching signals. Shared by the text-bearing detectors (IPTC, XMP, EXIF), which
 * pass the segment to scan and the standard-specific signals to emit.
 */
export function scanContentTerms(
  segment: Record<string, unknown> | undefined,
  violentSignal: MetadataSignal,
  explicitSignal: MetadataSignal
): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];

  const violentTerm = findMatchingTerm(segment, VIOLENCE_TERMS);
  if (violentTerm) {
    matches.push({ ...violentSignal, evidence: `Metadata text mentions violent-content term "${violentTerm}"` });
  }

  const explicitTerm = findMatchingTerm(segment, EXPLICIT_TERMS);
  if (explicitTerm) {
    matches.push({ ...explicitSignal, evidence: `Metadata text mentions explicit-content term "${explicitTerm}"` });
  }

  return matches;
}
