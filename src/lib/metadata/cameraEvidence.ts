import { CAMERA_MAKE_MODEL_TERMS, CAPTURE_SETTING_FIELD_NAMES, GPS_FIELD_NAMES, LENS_FIELD_NAMES } from './terms/cameraTerms';
import { findMatchingTerm, hasAnyField } from './textMatch';
import type { RawImageMetadata } from './types';

export interface CameraEvidence {
  hasMakeModel: boolean;
  hasLens: boolean;
  hasCaptureSettings: boolean;
  hasGps: boolean;
}

/** Collects independent signs that an image was captured by a real camera, from EXIF/GPS. */
export function collectCameraEvidence(metadata: RawImageMetadata): CameraEvidence {
  const exifAndIfd0 = { ...metadata.ifd0, ...metadata.exif };

  return {
    hasMakeModel: findMatchingTerm(exifAndIfd0, CAMERA_MAKE_MODEL_TERMS) !== null,
    hasLens: hasAnyField(exifAndIfd0, LENS_FIELD_NAMES),
    hasCaptureSettings: hasAnyField(exifAndIfd0, CAPTURE_SETTING_FIELD_NAMES),
    hasGps: hasAnyField(metadata.gps, GPS_FIELD_NAMES) || Object.keys(metadata.gps ?? {}).length > 0
  };
}

/** True when at least two independent camera signals agree — strong evidence this is a real photo. */
export function hasStrongCameraEvidence(evidence: CameraEvidence): boolean {
  const signalCount = [evidence.hasMakeModel, evidence.hasLens, evidence.hasCaptureSettings, evidence.hasGps].filter(
    Boolean
  ).length;
  return signalCount >= 2;
}