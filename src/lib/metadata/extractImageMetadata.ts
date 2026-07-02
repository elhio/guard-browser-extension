import * as exifr from 'exifr';
import type { RawImageMetadata } from './types';

/**
 * `mergeOutput: false` keeps each segment in its own sub-object (exif, xmp,
 * iptc, icc, jfif, ihdr, gps, ...) instead of flattening everything into one
 * bag of fields — required so each category detector only sees its own slice.
 */
const PARSE_OPTIONS = {
  mergeOutput: false,
  tiff: true,
  exif: true,
  gps: true,
  xmp: true,
  icc: true,
  iptc: true,
  jfif: true,
  ihdr: true
};

/** Parses EXIF/XMP/IPTC/ICC/JFIF/IHDR metadata out of an image. Returns an empty object if none is found. */
export async function extractImageMetadata(blob: Blob): Promise<RawImageMetadata> {
  const parsed = await exifr.parse(blob, PARSE_OPTIONS);
  return (parsed ?? {}) as RawImageMetadata;
}