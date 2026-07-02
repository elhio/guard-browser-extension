import type { Manifest, ManifestStore } from '@contentauth/c2pa-types';

/**
 * Walks the active manifest and its ingredient chain (the parent assets this
 * one was derived from), returning every manifest reachable from it.
 *
 * This matters for AI-generation detection: a multi-step provenance chain
 * (e.g. "created by an AI tool" -> "edited" -> "watermarked") typically
 * records each step in its own manifest, so the strongest AI signal often
 * lives on an early ingredient rather than the final, most-edited manifest.
 *
 * The first entry (if any) is always the store's active manifest.
 */
export function getManifestChain(manifestStore: ManifestStore | null): Manifest[] {
  if (!manifestStore?.manifests) return [];
  const manifestsByLabel = manifestStore.manifests;

  const chain: Manifest[] = [];
  const visited = new Set<string>();

  function visit(label: string | null | undefined): void {
    if (!label || visited.has(label)) return;
    const manifest = manifestsByLabel[label];
    if (!manifest) return;
    visited.add(label);
    chain.push(manifest);
    for (const ingredient of manifest.ingredients ?? []) {
      visit(ingredient.active_manifest);
    }
  }

  visit(manifestStore.active_manifest);
  return chain;
}