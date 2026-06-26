/**
 * Lower-cased name fragments of known AI image generation tools/vendors.
 * Matched as substrings against fields like softwareAgent or claim_generator,
 * which are free-text "Product/1.0"-style strings.
 */
export const KNOWN_AI_GENERATOR_VENDORS: readonly string[] = [
  'dall-e',
  'dalle',
  'openai',
  'firefly',
  'midjourney',
  'stable diffusion',
  'stability ai',
  'stability.ai',
  'leonardo.ai',
  'leonardo ai',
  'runwayml',
  'runway ml',
  'imagen',
  'ideogram',
  'nightcafe',
  'playground ai',
  'craiyon',
  'bing image creator',
  'copilot designer',
  'flux',
  'grok imagine',
  // Google's tools don't set softwareAgent; they identify themselves in free-text
  // action descriptions instead (e.g. "Created by Google Generative AI",
  // "Applied imperceptible SynthID watermark.") — see detectAiActionDescription.
  'gemini',
  'google generative ai',
  'synthid',
  // OpenAI's image model sets softwareAgent.name to "gpt-image" (its
  // claim_generator_info name is the more obvious "OpenAI Media Service API").
  'gpt-image'
];

/** Returns the matched vendor fragment if `text` names a known AI generator, otherwise null. */
export function matchesKnownAiVendor(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  return KNOWN_AI_GENERATOR_VENDORS.find((vendor) => lower.includes(vendor)) ?? null;
}
