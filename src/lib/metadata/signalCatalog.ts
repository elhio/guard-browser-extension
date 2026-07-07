import { METADATA_SIGNALS } from './signals';
import type { MetadataStandard, MetadataSignal } from './types';

/**
 * Represents a grouped summary of metadata detection signals for a specific metadata format or category
 *
 * @property standard - The overarching metadata standard (e.g., 'EXIF', 'XMP', 'IPTC')
 * @property signals - An array of all specific detection signals and rules associated with this category
 * @property parameters - A deduplicated list of every distinct field name or metadata tag analyzed across all signals in this category
 */
export interface MetadataCategorySummary {
  standard: MetadataStandard;
  signals: MetadataSignal[];
  parameters: string[];
}

/**
 * Compiles the global metadata signal catalog and groups it by metadata category
 *
 * @returns An array of standard summaries, each containing its associated signals and the deduplicated list of parameters analyzed
 */
export function getMetadataSignalCatalog(): MetadataCategorySummary[] {
  const byStandard = new Map<MetadataStandard, MetadataSignal[]>();

  for (const signal of Object.values(METADATA_SIGNALS)) {
    const existing = byStandard.get(signal.standard) ?? [];
    existing.push(signal);
    byStandard.set(signal.standard, existing);
  }

  return Array.from(byStandard.entries()).map(([standard, signals]) => ({
    standard,
    signals,
    parameters: Array.from(new Set(signals.flatMap((signal) => signal.parameters)))
  }));
}