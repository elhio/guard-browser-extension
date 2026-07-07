import { METADATA_SIGNALS } from '../signals';
import { AI_GENERATOR_TERMS } from '../terms/aiGeneratorTerms';
import { AI_SOURCE_TERMS } from '../terms/aiSourceTerms';
import { looksLikeTypicalAiDimension } from '../terms/aiDimensions';
import { findMatchingTerm } from '../textMatch';
import { collectCameraEvidence, hasStrongCameraEvidence } from '../cameraEvidence';
import type { MetadataSignalMatch, RawImageMetadata } from '../types';

/**
 * Creates a new object containing only the specified keys extracted from the source metadata
 *
 * @param metadata - The source metadata record to extract from
 * @param keys - An array of string keys to pick
 * @returns A new object containing only the requested key-value pairs that exist in the source
 */
function pick(metadata: Record<string, unknown> | undefined, keys: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (metadata?.[key] !== undefined) result[key] = metadata[key];
  }
  return result;
}

/**
 * Evaluates the metadata segments for signals indicating either AI generation or authentic real-world camera capture
 *
 * Note: This detector specifically scans for:
 * - Known AI generator tool names in the `Software` tag
 * - Diffusion-model generation parameters (e.g., prompts, seeds) embedded in comment tags
 * - Image resolutions matching default AI model outputs (e.g., 1024x1024)
 * - Strong counter-evidence like physical lens profiles, exposure settings, or GPS coordinates
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns An array of successfully matched metadata signals, populated with specific evidence strings
 */
export function detectExifSignals(metadata: RawImageMetadata): MetadataSignalMatch[] {
  const matches: MetadataSignalMatch[] = [];

  // IFD0 (Image File Directory 0) often contains the primary image tags like Make, Model, and Software,
  // while the EXIF sub-directory holds the specific camera settings. We evaluate them together.
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