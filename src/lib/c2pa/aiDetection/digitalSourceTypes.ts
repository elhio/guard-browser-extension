/**
 * A curated array of standardized IPTC and C2PA `digitalSourceType` URIs that explicitly
 * indicate an asset was generated, or substantially modified, by an algorithmic or AI model
 *
 * @see https://cv.iptc.org/newscodes/digitalsourcetype/
 */
export const AI_DIGITAL_SOURCE_TYPES: readonly string[] = [
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/dataDrivenMedia',
  'http://c2pa.org/digitalsourcetype/trainedAlgorithmicData'
];

/**
 * Evaluates whether a given `digitalSourceType` URI strictly matches a known AI-generation or synthetic media
 * identifier
 *
 * @param value - The digital source type string to check. Safely handles `null` or `undefined`
 * @returns `true` if the value matches a recognized AI source type URI, otherwise `false`
 */
export function isAiDigitalSourceType(value: string | null | undefined): boolean {
  if (!value) return false;
  return AI_DIGITAL_SOURCE_TYPES.includes(value);
}