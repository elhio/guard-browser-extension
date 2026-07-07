import * as exifr from 'exifr';
import type { RawImageMetadata } from './types';

/**
 * Configuration options for the `exifr` parsing library
 *
 * Note: `mergeOutput: false` is strictly required. This keeps each metadata segment
 * (EXIF, XMP, IPTC, ICC, JFIF, IHDR, GPS, etc.) isolated in its own distinct sub-object
 * instead of flattening them into one giant bag of fields. This separation ensures
 * that each format-specific detector only evaluates its intended slice of data.
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

/**
 * Extracts and parses various raw metadata segments out of a given image file
 *
 * @param blob - The binary image data (Blob or File) to be parsed
 * @returns A promise that resolves to a structured `RawImageMetadata` object containing the isolated metadata blocks
 */
export async function extractImageMetadata(blob: Blob): Promise<RawImageMetadata> {
  const parsed = await exifr.parse(blob, PARSE_OPTIONS);
  return (parsed ?? {}) as RawImageMetadata;
}