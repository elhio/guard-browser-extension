import { CAMERA_MAKE_MODEL_TERMS, CAPTURE_SETTING_FIELD_NAMES, GPS_FIELD_NAMES, LENS_FIELD_NAMES } from './terms/cameraTerms';
import { findMatchingTerm, hasAnyField } from './textMatch';
import type { RawImageMetadata } from './types';

/**
 * A collection of boolean flags indicating the presence of specific hardware or
 * real-world capture signatures found in the image's metadata
 *
 * @property hasMakeModel - True if the metadata contains hardware manufacturer or camera model identifiers
 * @property hasLens - True if specific lens profile or optical parameters are embedded
 * @property hasCaptureSettings - True if real-world exposure settings (e.g., shutter speed, aperture, ISO) are present
 * @property hasGps - True if geographic coordinate data is attached to the image
 */
export interface CameraEvidence {
  hasMakeModel: boolean;
  hasLens: boolean;
  hasCaptureSettings: boolean;
  hasGps: boolean;
}

/**
 * Evaluates the raw EXIF, IFD0, and GPS metadata to collect independent signs that
 * an image was captured by a physical camera rather than generated synthetically
 *
 * @param metadata - The raw, parsed metadata blocks extracted from the image file
 * @returns A populated `CameraEvidence` object containing boolean flags for each signature type
 */
export function collectCameraEvidence(metadata: RawImageMetadata): CameraEvidence {
  const exifAndIfd0 = { ...metadata.ifd0, ...metadata.exif };

  return {
    hasMakeModel: findMatchingTerm(exifAndIfd0, CAMERA_MAKE_MODEL_TERMS) !== null,
    hasLens: hasAnyField(exifAndIfd0, LENS_FIELD_NAMES),
    hasCaptureSettings: hasAnyField(exifAndIfd0, CAPTURE_SETTING_FIELD_NAMES),
    hasGps: hasAnyField(metadata.gps, GPS_FIELD_NAMES) || Object.keys(metadata.gps ?? {}).length > 0
  };
}

/**
 * Determines if the collected camera evidence is robust enough to confidently classify
 * the image as an authentic, real-world capture
 *
 * @param evidence - The evaluated camera evidence object
 * @returns True if two or more independent hardware/capture signals are present
 */
export function hasStrongCameraEvidence(evidence: CameraEvidence): boolean {
  const signalCount = [
    evidence.hasMakeModel,
    evidence.hasLens,
    evidence.hasCaptureSettings,
    evidence.hasGps
  ].filter(Boolean).length;

  return signalCount >= 2;
}