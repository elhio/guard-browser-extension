import type { Manifest } from '@contentauth/c2pa-types';
import { AI_SIGNALS } from './signals';
import type { DetectionSignalMatch } from './types';
import { matchesKnownAiVendor } from './vendors';
import { isAiDigitalSourceType } from '@/lib/c2pa';
import { containsGenerativeAiMarker } from './metadataMarkers';
import { getActions, getSoftwareAgentName } from './manifestActions';

/**
 * Defines the standard signature for an AI signal detector
 */
export type AiSignalDetector = (manifest: Manifest) => DetectionSignalMatch | null;

/**
 * Helper utility to extract a readable reference name for a manifest
 *
 * @param manifest - The C2PA manifest being evaluated
 * @returns The manifest label, or a fallback string if unlabeled
 */
function manifestRef(manifest: Manifest): string {
  return manifest.label ?? '(unlabeled manifest)';
}

/**
 * Detects explicit C2PA assertions indicating generative AI usage
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if the assertion is present, otherwise null
 */
export function detectGenerativeInfoAssertion(manifest: Manifest): DetectionSignalMatch | null {
  const assertion = (manifest.assertions ?? []).find((a) => a.label.startsWith('c2pa.ai.generative_info'));
  if (!assertion) return null;
  return {
    ...AI_SIGNALS.generativeInfoAssertion,
    evidence: `assertion "${assertion.label}" present in ${manifestRef(manifest)}`
  };
}

/**
 * Detects C2PA actions explicitly tagged as AI-generated
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if an AI-generated action is found, otherwise null
 */
export function detectAiGeneratedAction(manifest: Manifest): DetectionSignalMatch | null {
  const action = getActions(manifest).find((a) => a.action.endsWith('ai_generated'));
  if (!action) return null;
  return {
    ...AI_SIGNALS.aiGeneratedAction,
    evidence: `action "${action.action}" in ${manifestRef(manifest)}`
  };
}

/**
 * Detects if the source of the asset is flagged as an AI digital source
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if a synthetic digital source type is found, otherwise null
 */
export function detectAiDigitalSourceType(manifest: Manifest): DetectionSignalMatch | null {
  const action = getActions(manifest).find((a) => isAiDigitalSourceType(a.digitalSourceType));
  if (!action) return null;
  return {
    ...AI_SIGNALS.aiDigitalSourceType,
    evidence: `digitalSourceType "${action.digitalSourceType}" in ${manifestRef(manifest)}`
  };
}

/**
 * Detects if the software agent that performed an action is a known AI vendor
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if the software agent matches a known AI tool, otherwise null
 */
export function detectAiSoftwareAgent(manifest: Manifest): DetectionSignalMatch | null {
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
 * Evaluates free-text action descriptions for known AI vendor names
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if the description text matches a known AI vendor, otherwise null
 */
export function detectAiActionDescription(manifest: Manifest): DetectionSignalMatch | null {
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

/**
 * Scans raw assertion data for embedded metadata markers that indicate generative AI
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if a generative AI metadata marker is embedded in the assertion data, otherwise null
 */
export function detectGenerativeAiMetadataMarker(manifest: Manifest): DetectionSignalMatch | null {
  const assertion = (manifest.assertions ?? []).find((a) => containsGenerativeAiMarker(a.data));
  if (!assertion) return null;
  return {
    ...AI_SIGNALS.generativeAiMetadataMarker,
    evidence: `assertion "${assertion.label}" contains a generativeAI marker in ${manifestRef(manifest)}`
  };
}

/**
 * Detects if the software that originally generated the C2PA claim is a known AI tool
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if the claim generator is flagged as an AI vendor, otherwise null
 */
export function detectAiClaimGenerator(manifest: Manifest): DetectionSignalMatch | null {
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

/**
 * Detects assertions related to AI training or data mining operations
 *
 * @param manifest - The C2PA manifest to evaluate
 * @returns A signal match if a training/mining assertion is present, otherwise null
 */
export function detectTrainingOrMiningAssertion(manifest: Manifest): DetectionSignalMatch | null {
  const assertion = (manifest.assertions ?? []).find((a) => a.label.startsWith('c2pa.ai.training_mining'));
  if (!assertion) return null;
  return {
    ...AI_SIGNALS.trainingMiningAssertion,
    evidence: `assertion "${assertion.label}" present in ${manifestRef(manifest)}`
  };
}

/**
 * The aggregated pipeline of all available AI signal detectors
 */
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