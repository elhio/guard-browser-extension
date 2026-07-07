import type { Action, ClaimGeneratorInfo, Manifest } from '@contentauth/c2pa-types';

/**
 * Extracts all recorded actions from a C2PA manifest's assertion data.
 *
 * @param manifest - The parsed C2PA manifest to evaluate
 * @returns A flat array of `Action` objects detailing the modifications or generation steps performed on the asset
 */
export function getActions(manifest: Manifest): Action[] {
  return (manifest.assertions ?? [])
    .filter((assertion) => assertion.label === 'c2pa.actions' || assertion.label.startsWith('c2pa.actions.'))
    .flatMap((assertion) => {
      const data = assertion.data as { actions?: Action[] } | undefined;
      return data?.actions ?? [];
    });
}

/**
 * Safely resolves the name of the software agent responsible for a specific action.
 *
 * @param softwareAgent - The `softwareAgent` property extracted from a C2PA `Action`
 * @returns The extracted name of the software tool/vendor, or `null` if the agent data is missing
 */
export function getSoftwareAgentName(softwareAgent: Action['softwareAgent']): string | null {
  if (!softwareAgent) return null;
  return typeof softwareAgent === 'string' ? softwareAgent : (softwareAgent as ClaimGeneratorInfo).name;
}