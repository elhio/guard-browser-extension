import type { Manifest } from '@contentauth/c2pa-types';
import { AI_SIGNALS } from './signals';
import type { AiSignalMatch } from './types';
import { matchesKnownAiVendor } from './vendors';
import { isAiDigitalSourceType } from '@/lib/c2pa';
import { containsGenerativeAiMarker } from './metadataMarkers';
import { getActions, getSoftwareAgentName } from './manifestActions';

export type AiSignalDetector = (manifest: Manifest) => AiSignalMatch | null;

function manifestRef(manifest: Manifest): string {
  return manifest.label ?? '(unlabeled manifest)';
}

export function detectGenerativeInfoAssertion(manifest: Manifest): AiSignalMatch | null {
  const assertion = (manifest.assertions ?? []).find((a) => a.label.startsWith('c2pa.ai.generative_info'));
  if (!assertion) return null;
  return {
    ...AI_SIGNALS.generativeInfoAssertion,
    evidence: `assertion "${assertion.label}" present in ${manifestRef(manifest)}`
  };
}

export function detectAiGeneratedAction(manifest: Manifest): AiSignalMatch | null {
  const action = getActions(manifest).find((a) => a.action.endsWith('ai_generated'));
  if (!action) return null;
  return {
    ...AI_SIGNALS.aiGeneratedAction,
    evidence: `action "${action.action}" in ${manifestRef(manifest)}`
  };
}

export function detectAiDigitalSourceType(manifest: Manifest): AiSignalMatch | null {
  const action = getActions(manifest).find((a) => isAiDigitalSourceType(a.digitalSourceType));
  if (!action) return null;
  return {
    ...AI_SIGNALS.aiDigitalSourceType,
    evidence: `digitalSourceType "${action.digitalSourceType}" in ${manifestRef(manifest)}`
  };
}

export function detectAiSoftwareAgent(manifest: Manifest): AiSignalMatch | null {
  for (const action of getActions(manifest)) {
    const name = getSoftwareAgentName(action.softwareAgent);
    const vendor = matchesKnownAiVendor(name);
    if (vendor) {
      return {
        ...AI_SIGNALS.softwareAgentVendor,
        evidence: `softwareAgent "${name}" matches known AI vendor "${vendor}" in ${manifestRef(manifest)}`
      };
    }
  }
  return null;
}

/**
 * Some vendors (e.g. Google's Gemini/SynthID) don't set softwareAgent at all —
 * they identify themselves only in an action's free-text `description`
 * (e.g. "Created by Google Generative AI", "Applied imperceptible SynthID watermark.").
 */
export function detectAiActionDescription(manifest: Manifest): AiSignalMatch | null {
  for (const action of getActions(manifest)) {
    const vendor = matchesKnownAiVendor(action.description);
    if (vendor) {
      return {
        ...AI_SIGNALS.actionDescriptionVendor,
        evidence: `action description "${action.description}" matches known AI vendor "${vendor}" in ${manifestRef(manifest)}`
      };
    }
  }
  return null;
}

export function detectGenerativeAiMetadataMarker(manifest: Manifest): AiSignalMatch | null {
  const assertion = (manifest.assertions ?? []).find((a) => containsGenerativeAiMarker(a.data));
  if (!assertion) return null;
  return {
    ...AI_SIGNALS.generativeAiMetadataMarker,
    evidence: `assertion "${assertion.label}" contains a generativeAI marker in ${manifestRef(manifest)}`
  };
}

export function detectAiClaimGenerator(manifest: Manifest): AiSignalMatch | null {
  const candidates = [manifest.claim_generator, ...(manifest.claim_generator_info ?? []).map((info) => info.name)];
  for (const candidate of candidates) {
    const vendor = matchesKnownAiVendor(candidate);
    if (vendor) {
      return {
        ...AI_SIGNALS.claimGeneratorVendor,
        evidence: `claim generator "${candidate}" matches known AI vendor "${vendor}" in ${manifestRef(manifest)}`
      };
    }
  }
  return null;
}

export function detectTrainingOrMiningAssertion(manifest: Manifest): AiSignalMatch | null {
  const assertion = (manifest.assertions ?? []).find((a) => a.label.startsWith('c2pa.ai.training_mining'));
  if (!assertion) return null;
  return {
    ...AI_SIGNALS.trainingMiningAssertion,
    evidence: `assertion "${assertion.label}" present in ${manifestRef(manifest)}`
  };
}

export const AI_SIGNAL_DETECTORS: readonly AiSignalDetector[] = [
  detectGenerativeInfoAssertion,
  detectAiGeneratedAction,
  detectAiDigitalSourceType,
  detectAiSoftwareAgent,
  detectAiActionDescription,
  detectGenerativeAiMetadataMarker,
  detectAiClaimGenerator,
  detectTrainingOrMiningAssertion
];
