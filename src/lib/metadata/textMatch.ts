/**
 * Recursively flattens a metadata object's values (and its keys) into a single
 * space-separated string for broad term scanning
 *
 * @param value - The unknown data structure (object, array, or primitive) to flatten
 * @param depth - The current recursion depth. Capped at 4 to prevent infinite loops or excessive memory usage
 * @returns A concatenated string containing all nested keys and primitive values
 */
function flattenToSearchableText(value: unknown, depth = 0): string {
  if (depth > 4 || value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenToSearchableText(item, depth + 1)).join(' ');
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nested]) => `${key} ${flattenToSearchableText(nested, depth + 1)}`)
      .join(' ');
  }

  return '';
}

/**
 * Searches a metadata object for the first occurrence of any specified term (case-insensitive, scans all keys and
 * values up to a depth of 4)
 *
 * @param metadata - The metadata record to search within (e.g., the parsed XMP block)
 * @param terms - An array of search terms to look for
 * @returns The first matching term found in the flattened metadata text, or null if no match occurs
 */
export function findMatchingTerm(
  metadata: Record<string, unknown> | undefined,
  terms: readonly string[]
): string | null {
  if (!metadata) return null;
  const haystack = flattenToSearchableText(metadata).toLowerCase();
  return terms.find((term) => haystack.includes(term.toLowerCase())) ?? null;
}

/**
 * Checks if any of the provided field names exist as top-level keys in the metadata object (case-insensitive)
 *
 * @param metadata - The metadata record to inspect
 * @param fieldNames - An array of specific field names to look for as keys
 * @returns True if at least one matching key is found at the top level of the metadata object
 */
export function hasAnyField(
  metadata: Record<string, unknown> | undefined,
  fieldNames: readonly string[]
): boolean {
  if (!metadata) return false;
  const lowerFieldNames = fieldNames.map((name) => name.toLowerCase());
  return Object.keys(metadata).some((key) => lowerFieldNames.includes(key.toLowerCase()));
}