import type { AiSignal } from './types';
import { AI_DETECTION_CONFIDENCE_THRESHOLD } from '@/lib/aiSignals/threshold';

export { AI_DETECTION_CONFIDENCE_THRESHOLD };

/**
 * Catalog of AI-generation signals, in descending confidence order.
 * Several of these (the c2pa.ai.* labels) are not yet part of the official
 * C2PA spec vocabulary but are emerging/vendor conventions; detectors match
 * them leniently (prefix/substring) rather than requiring an exact label.
 */
export const AI_SIGNALS = {
  generativeInfoAssertion: {
    id: 'c2pa.ai.generative_info',
    label: 'c2pa.ai.generative_info',
    description: 'Explicit AI assertion (since C2PA 2.0)',
    confidence: 95
  },
  aiGeneratedAction: {
    id: 'c2pa.ai_generated',
    label: 'c2pa.ai_generated action',
    description: 'Explicit action marker for AI generation',
    confidence: 95
  },
  aiDigitalSourceType: {
    id: 'digitalSourceType.ai',
    label: 'AI-indicating digitalSourceType',
    description: 'IPTC digitalSourceType names an algorithmic/AI source',
    confidence: 90
  },
  softwareAgentVendor: {
    id: 'softwareAgent.vendor',
    label: 'AI tool name in softwareAgent',
    description: 'DALL-E, Firefly, Midjourney, Stable Diffusion, ...',
    confidence: 85
  },
  actionDescriptionVendor: {
    id: 'action.description.vendor',
    label: 'AI tool name in action description',
    description: 'Free-text action description names a known AI vendor (e.g. Gemini, SynthID)',
    confidence: 80
  },
  generativeAiMetadataMarker: {
    id: 'generativeAI',
    label: 'generativeAI marker in metadata',
    description: 'Adobe-specific metadata field',
    confidence: 85
  },
  claimGeneratorVendor: {
    id: 'claim_generator.vendor',
    label: 'AI tool in claim generator',
    description: "Generator field of the signed claim",
    confidence: 80
  },
  trainingMiningAssertion: {
    id: 'c2pa.ai.training_mining',
    label: 'c2pa.ai.training_mining',
    description: 'Indirect — hints at an AI training/data-mining context',
    confidence: 40
  }
} as const satisfies Record<string, AiSignal>;
