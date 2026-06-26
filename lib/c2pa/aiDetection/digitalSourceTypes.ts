/**
 * IPTC/C2PA digitalSourceType URIs that indicate the asset was produced or
 * substantially produced by an algorithm/AI model, as opposed to e.g. a
 * digital camera capture or manual human edits.
 * See https://cv.iptc.org/newscodes/digitalsourcetype/
 */
export const AI_DIGITAL_SOURCE_TYPES: readonly string[] = [
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/dataDrivenMedia',
  'http://c2pa.org/digitalsourcetype/trainedAlgorithmicData'
];

export function isAiDigitalSourceType(value: string | null | undefined): boolean {
  if (!value) return false;
  return AI_DIGITAL_SOURCE_TYPES.includes(value);
}
