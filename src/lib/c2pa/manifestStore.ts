import type { Manifest, ManifestStore } from '@contentauth/c2pa-types';

/**
 * Traverses the active C2PA manifest and recursively flattens its ingredient chain
 *
 * @param manifestStore - The root store containing the parsed manifests and the pointer to the active manifest
 * @returns A flat array of `Manifest` objects, starting with the active manifest and followed by its historical ingredients
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

    // Traverse downwards into the assets this manifest was derived from
    for (const ingredient of manifest.ingredients ?? []) {
      visit(ingredient.active_manifest);
    }
  }

  visit(manifestStore.active_manifest);

  return chain;
}