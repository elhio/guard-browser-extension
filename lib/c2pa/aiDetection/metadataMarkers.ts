const GENERATIVE_AI_MARKER_KEYS = ['generativeai', 'generative_ai'];

/**
 * Recursively searches an assertion's (loosely-typed) data for a truthy
 * "generativeAI"-style key. Depth is bounded since assertion payloads are
 * small, structured documents, not arbitrary user data.
 */
export function containsGenerativeAiMarker(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsGenerativeAiMarker(item, depth + 1));
  }

  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (GENERATIVE_AI_MARKER_KEYS.includes(key.toLowerCase())) {
      return nested !== false && nested !== null && nested !== undefined;
    }
    return containsGenerativeAiMarker(nested, depth + 1);
  });
}
