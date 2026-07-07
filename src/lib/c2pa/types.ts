import type { ManifestStore } from '@contentauth/c2pa-types';
import type { ImageCandidate } from '@/lib/images';
import type { CategoryDetectionResult } from '@/lib/detection/types';

/**
 * Represents a successful attempt to read C2PA metadata from an image
 *
 * @property status - Literal indicator that the read operation completed without throwing errors
 * @property candidate - The original image candidate that was analyzed
 * @property manifestStore - The manifest store returned by c2pa-web; null when the asset has no C2PA data
 * @property aiDetection - The results of analyzing the active manifest for AI generation signatures
 */
export interface C2paReadSuccess {
  status: 'success';
  candidate: ImageCandidate;
  manifestStore: ManifestStore | null;
  aiDetection: CategoryDetectionResult;
}

/**
 * Represents a failed attempt to read C2PA metadata from an image
 *
 * @property status - Literal indicator that the read operation failed
 * @property candidate - The original image candidate that was attempted to be analyzed
 * @property error - A descriptive message explaining why the read operation failed
 */
export interface C2paReadError {
  status: 'error';
  candidate: ImageCandidate;
  error: string;
}

/**
 * A discriminated union representing the final outcome of a C2PA metadata read operation
 */
export type C2paReadResult = C2paReadSuccess | C2paReadError;
