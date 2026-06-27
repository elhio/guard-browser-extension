import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_TERMS } from '../terms/aiGeneratorTerms';
import { AI_SOURCE_TERMS } from '../terms/aiSourceTerms';
import { looksLikeTypicalAiDimension } from '../terms/aiDimensions';
import { findMatchingTerm } from '../textMatch';
import { collectCameraEvidence, hasStrongCameraEvidence } from '../cameraEvidence';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

function pick(metadata: Record<string, unknown> | undefined, keys: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (metadata?.[key] !== undefined) result[key] = metadata[key];
  }
  return result;
}

/** Detects AI-generation signals in the EXIF/TIFF segment (software tag, comments, dimensions, camera evidence). */
export function detectExifSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];
  const exifAndIfd0 = { ...metadata.ifd0, ...metadata.exif };

  const softwareFields = pick(exifAndIfd0, METADATA_SIGNALS.exifSoftwareVendor.parameters);
  const softwareVendor = findMatchingTerm(softwareFields, AI_GENERATOR_TERMS);
  if (softwareVendor) {
    matches.push({
      ...METADATA_SIGNALS.exifSoftwareVendor,
      evidence: `EXIF software field matches known AI vendor "${softwareVendor}"`
    });
  }

  const commentFields = pick(exifAndIfd0, METADATA_SIGNALS.exifGenerationParameters.parameters);
  const sourceTerm = findMatchingTerm(commentFields, AI_SOURCE_TERMS);
  if (sourceTerm) {
    matches.push({
      ...METADATA_SIGNALS.exifGenerationParameters,
      evidence: `EXIF comment field contains generation-parameter term "${sourceTerm}"`
    });
  }

  const width = (exifAndIfd0.ExifImageWidth ?? exifAndIfd0.ImageWidth) as number | undefined;
  const height = (exifAndIfd0.ExifImageHeight ?? exifAndIfd0.ImageHeight) as number | undefined;
  if (looksLikeTypicalAiDimension(width, height)) {
    matches.push({
      ...METADATA_SIGNALS.exifTypicalAiDimension,
      evidence: `Image dimensions ${width}x${height} match a common AI generator output size`
    });
  }

  const cameraEvidence = collectCameraEvidence(metadata);
  if (hasStrongCameraEvidence(cameraEvidence)) {
    matches.push({
      ...METADATA_SIGNALS.exifCameraCapture,
      evidence: `Camera capture evidence: make/model=${cameraEvidence.hasMakeModel}, lens=${cameraEvidence.hasLens}, captureSettings=${cameraEvidence.hasCaptureSettings}`
    });
  }

  if (cameraEvidence.hasGps) {
    matches.push({
      ...METADATA_SIGNALS.exifGps,
      evidence: 'GPS coordinates present in EXIF/GPS segment'
    });
  }

  return matches;
}
