/**
 * A curated list of known AI image generation tools, models, and vendor name fragments
 *
 * Note: These strings are intentionally lower-cased and represent name *fragments*. They are used for lenient substring
 * matching against free-text fields like `softwareAgent`, `claim_generator`, or action descriptions, which often
 * contain versioned formats like "Product/1.0" or "Service API".
 *
 * Architectural Note (Vendor Edge Cases):
 * - Google: Tools like Gemini often do not set the `softwareAgent` field at all. Instead, they identify themselves
 *   in free-text action descriptions (e.g., "Created by Google Generative AI" or "Applied imperceptible SynthID
 *   watermark.").
 * - OpenAI: The standard image model sets `softwareAgent.name` to the obscure `"gpt-image"`, though its
 *   `claim_generator_info` is more explicit ("OpenAI Media Service API").
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
  'gemini',
  'google generative ai',
  'synthid',
  'gpt-image'
];

/**
 * Evaluates a given text string to see if it contains a reference to a known AI generation tool or vendor.
 *
 * @param text - The free-text string to evaluate (e.g., from `softwareAgent.name`)
 * @returns The specific vendor fragment string that was matched, or `null` if the text is clean
 */
export function matchesKnownAiVendor(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  return KNOWN_AI_GENERATOR_VENDORS.find((vendor) => lower.includes(vendor)) ?? null;
}