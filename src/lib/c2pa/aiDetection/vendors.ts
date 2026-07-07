import { AI_GENERATOR_VENDORS } from '@/lib/detection';

/**
 * Evaluates a given text string to see if it contains a reference to a known AI generation tool or vendor.
 *
 * Note on vendor edge cases:
 * - Google: Tools like Gemini often don't set `softwareAgent` at all; they identify themselves in free-text action
 *   descriptions (e.g. "Created by Google Generative AI" or "Applied imperceptible SynthID watermark.").
 * - OpenAI: The standard image model sets `softwareAgent.name` to the obscure `"gpt-image"`, though its
 *   `claim_generator_info` is more explicit ("OpenAI Media Service API").
 *
 * @param text - The free-text string to evaluate (e.g., from `softwareAgent.name`)
 * @returns The specific vendor fragment string that was matched, or `null` if the text is clean
 */
export function matchesKnownAiVendor(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  return AI_GENERATOR_VENDORS.find((vendor) => lower.includes(vendor)) ?? null;
}