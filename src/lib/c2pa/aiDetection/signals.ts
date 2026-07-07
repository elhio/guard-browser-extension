import type { DetectionSignal } from './types';

/**
 * A centralized catalog of known AI-generation signals, organized by detection confidence.
 */
export const AI_SIGNALS = {
  generativeInfoAssertion: {
    id: 'c2pa.ai.generative_info',
    label: 'c2pa.ai.generative_info',
    description: 'Explicit AI assertion (since C2PA 2.0)',
    category: 'aiGenerated',
    confidence: 95
  },
  aiGeneratedAction: {
    id: 'c2pa.ai_generated',
    label: 'c2pa.ai_generated action',
    description: 'Explicit action marker for AI generation',
    category: 'aiGenerated',
    confidence: 95
  },
  aiDigitalSourceType: {
    id: 'digitalSourceType.ai',
    label: 'AI-indicating digitalSourceType',
    description: 'IPTC digitalSourceType names an algorithmic/AI source',
    category: 'aiGenerated',
    confidence: 90
  },
  softwareAgentVendor: {
    id: 'softwareAgent.vendor',
    label: 'AI tool name in softwareAgent',
    description: 'DALL-E, Firefly, Midjourney, Stable Diffusion, ...',
    category: 'aiGenerated',
    confidence: 85
  },
  actionDescriptionVendor: {
    id: 'action.description.vendor',
    label: 'AI tool name in action description',
    description: 'Free-text action description names a known AI vendor (e.g. Gemini, SynthID)',
    category: 'aiGenerated',
    confidence: 80
  },
  generativeAiMetadataMarker: {
    id: 'generativeAI',
    label: 'generativeAI marker in metadata',
    description: 'Adobe-specific metadata field',
    category: 'aiGenerated',
    confidence: 85
  },
  claimGeneratorVendor: {
    id: 'claim_generator.vendor',
    label: 'AI tool in claim generator',
    description: 'Generator field of the signed claim',
    category: 'aiGenerated',
    confidence: 80
  },
  trainingMiningAssertion: {
    id: 'c2pa.ai.training_mining',
    label: 'c2pa.ai.training_mining',
    description: 'Indirect — hints at an AI training/data-mining context',
    category: 'aiGenerated',
    confidence: 40
  }
} as const satisfies Record<string, DetectionSignal>;