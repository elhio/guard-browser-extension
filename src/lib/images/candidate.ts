import type { ImageCandidate } from './types';

/**
 * Extracts safely file name from a given URL
 *
 * @param url - The full URL string to parse.
 * @returns The extracted file name, or an empty string if URL parsing fails or no path exists.
 */
export function getFileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.split('/').pop() ?? '';
  } catch {
    return '';
  }
}

/**
 * Extracts the lowercased file extension from a given file name
 *
 * @returns The lowercased extension (e.g., "jpg"), or an empty string if no extension is found
 */
export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

/**
 * Constructs a standardized `ImageCandidate` object from a source URL and an optional DOM element
 *
 * @param src - The absolute URL source of the image
 * @param element - The optional HTML image element associated with this image (used for UI overlays)
 * @returns A fully populated `ImageCandidate` object ready for scanning and classification
 */
export function toImageCandidate(
  src: string,
  element?: HTMLImageElement
): ImageCandidate {
  const fileName = getFileNameFromUrl(src);
  return {
    src,
    element,
    fileName,
    fileExtension: getFileExtension(fileName)
  };
}