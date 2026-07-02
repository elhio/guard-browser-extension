import { METADATA_SIGNALS } from './signals';
import type { MetadataCategory, MetadataSignal } from './types';

export interface MetadataCategorySummary {
  category: MetadataCategory;
  signals: MetadataSignal[];
  /** Every distinct field name analyzed for this category, across all its signals. */
  parameters: string[];
}

/** Groups the signal catalog by metadata category — what gets analyzed, and with what confidence. */
export function getMetadataSignalCatalog(): MetadataCategorySummary[] {
  const byCategory = new Map<MetadataCategory, MetadataSignal[]>();

  for (const signal of Object.values(METADATA_SIGNALS)) {
    const existing = byCategory.get(signal.category) ?? [];
    existing.push(signal);
    byCategory.set(signal.category, existing);
  }

  return Array.from(byCategory.entries()).map(([category, signals]) => ({
    category,
    signals,
    parameters: Array.from(new Set(signals.flatMap((signal) => signal.parameters)))
  }));
}