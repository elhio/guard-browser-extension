import type { ImageCandidate } from './types';

/** Pulls the file name (last path segment) out of a URL, ignoring query/hash. */
export function getFileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.split('/').pop() ?? '';
  } catch {
    return '';
  }
}

/** Lowercased extension without the dot, e.g. "image.JPG?x=1" -> "jpg". */
export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

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
