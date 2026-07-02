import type { Action, ClaimGeneratorInfo, Manifest } from '@contentauth/c2pa-types';

/** Pulls all actions out of a manifest's c2pa.actions (v1/v2) assertions. */
export function getActions(manifest: Manifest): Action[] {
  return (manifest.assertions ?? [])
    .filter((assertion) => assertion.label === 'c2pa.actions' || assertion.label.startsWith('c2pa.actions.'))
    .flatMap((assertion) => {
      const data = assertion.data as { actions?: Action[] } | undefined;
      return data?.actions ?? [];
    });
}

/** An action's softwareAgent is either a plain name string or a ClaimGeneratorInfo object. */
export function getSoftwareAgentName(softwareAgent: Action['softwareAgent']): string | null {
  if (!softwareAgent) return null;
  return typeof softwareAgent === 'string' ? softwareAgent : (softwareAgent as ClaimGeneratorInfo).name;
}