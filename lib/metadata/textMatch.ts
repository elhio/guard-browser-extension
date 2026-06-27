/** Flattens a metadata object's values (and its keys) into one lowercased string for term scanning. */
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

/** Returns the first term found inside `metadata`'s keys/values (case-insensitive), or null. */
export function findMatchingTerm(
  metadata: Record<string, unknown> | undefined,
  terms: readonly string[]
): string | null {
  if (!metadata) return null;
  const haystack = flattenToSearchableText(metadata).toLowerCase();
  return terms.find((term) => haystack.includes(term.toLowerCase())) ?? null;
}

/** Whether any of `fieldNames` exists as a key anywhere in `metadata` (case-insensitive, shallow + one level deep). */
export function hasAnyField(metadata: Record<string, unknown> | undefined, fieldNames: readonly string[]): boolean {
  if (!metadata) return false;
  const lowerFieldNames = fieldNames.map((name) => name.toLowerCase());
  return Object.keys(metadata).some((key) => lowerFieldNames.includes(key.toLowerCase()));
}
