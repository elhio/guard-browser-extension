export interface ImageCandidate {
  /** Absolute URL of the image source. */
  src: string;
  /** The <img> element this candidate was found on, if scanned from the live DOM. */
  element?: HTMLImageElement;
  /** File name parsed from the URL, if any. */
  fileName: string;
  /** Lowercased file extension without the leading dot, e.g. "jpg". */
  fileExtension: string;
}

/**
 * A filter decides whether an ImageCandidate should be kept.
 * Filters are composed in `scanPageImages` so new ones (filetype, name, size, ...)
 * can be added without touching the scanning logic itself.
 */
export type ImageFilter = (candidate: ImageCandidate) => boolean;