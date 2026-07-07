/**
 * A curated list of object keys commonly used in loosely-typed metadata dictionaries
 * to indicate the presence of generative AI
 */
const GENERATIVE_AI_MARKER_KEYS = ['generativeai', 'generative_ai'];

/**
 * Recursively searches an unknown, loosely-typed metadata payload for specific "generativeAI" marker keys.
 *
 * @param value - The unknown assertion data (object, array, or primitive) to search
 * @param depth - The current recursion depth (internal use, defaults to 0)
 * @returns `true` if a truthy generative AI marker is found within the bounding depth, otherwise `false`
 */
export function containsGenerativeAiMarker(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsGenerativeAiMarker(item, depth + 1));
  }

  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    // Check if the current key is one of our target markers
    if (GENERATIVE_AI_MARKER_KEYS.includes(key.toLowerCase())) {
      return nested !== false && nested !== null && nested !== undefined;
    }
    return containsGenerativeAiMarker(nested, depth + 1);
  });
}