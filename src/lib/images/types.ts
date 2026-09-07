/**
 * Represents a single image discovered on a web page, normalized for downstream analysis
 *
 * @property src - The absolute, resolved URL of the image source
 * @property element - The first live DOM `<img>` element this candidate was found on
 * @property elements - Every `<img>` currently showing this URL, in document order. A page often
 *   renders one image several times (Reddit backs a post photo with two blurred copies of itself), and
 *   each of those needs its own badge even though the URL is classified only once.
 * @property fileName - The file name extracted from the URL path, if one exists
 * @property fileExtension - The lowercased file extension without the leading dot (e.g., "jpg", "png")
 */
export interface ImageCandidate {
  src: string;
  element?: HTMLImageElement;
  elements: HTMLImageElement[];
  fileName: string;
  fileExtension: string;
}

/**
 * A predicate function used to determine whether an `ImageCandidate` should be retained for analysis

 * @param candidate - The normalized image candidate being evaluated
 * @returns True if the candidate passes the filter and should be kept; otherwise, false
 */
export type ImageFilter = (candidate: ImageCandidate) => boolean;