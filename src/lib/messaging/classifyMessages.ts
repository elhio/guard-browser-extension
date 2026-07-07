import type { SerializableImageCandidate } from '@/lib/images';
import type { TasksState } from '@/components/setup/TaskSelectionStep';
import type { ImageAnalysisResult } from '@/lib/detection/types';

/**
 * The unique identifier used by content scripts to request image classification
 */
export const CLASSIFY_IMAGE_MESSAGE = 'CLASSIFY_IMAGE_MESSAGE';

/**
 * The unique identifier used by the background script to forward heavy tasks
 */
export const CLASSIFY_IMAGE_OFFSCREEN_MESSAGE = 'CLASSIFY_IMAGE_OFFSCREEN_MESSAGE';

/**
 * The unified payload sent from the content script to request classification for a batch of images
 *
 * @property type - The routing identifier for this message
 * @property candidates - An array of serializable image candidates to be analyzed
 * @property tasks - The user's active moderation settings (AI, violent, explicit)
 * @property useDetectorLocalModel - Flag indicating if the local model should be run alongside metadata checks
 */
export interface ClassifyImageRequest {
  type: typeof CLASSIFY_IMAGE_MESSAGE;
  candidates: SerializableImageCandidate[];
  tasks: TasksState;
  useDetectorLocalModel: boolean;
}

/**
 * The payload forwarded by the background script to the offscreen document for processing
 */
export interface OffscreenClassifyImageRequest {
  type: typeof CLASSIFY_IMAGE_OFFSCREEN_MESSAGE;
  candidates: SerializableImageCandidate[];
  tasks: TasksState;
  useDetectorLocalModel: boolean;
}

export type ClassifyImageResult =
  | ({ status: 'success' } & ImageAnalysisResult)
  | { status: 'error'; src: string; error: string };

/**
 * The unified response payload returned after processing the batch of images.
 *
 * @property results - An array containing the merged metadata and local model results for each candidate
 */
export interface ClassifyImageResponse {
  results: ClassifyImageResult[];
}

/**
 * Internal helper to safely verify if an unknown message object contains a specific 'type' property
 */
function hasMessageType(message: unknown, type: string): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === type
  );
}

/**
 * Type Guard: Safely checks if an incoming generic message is a standard `ClassifyImageRequest`
 */
export function isClassifyImageRequest(
  message: unknown
): message is ClassifyImageRequest {
  return hasMessageType(message, CLASSIFY_IMAGE_MESSAGE);
}

/**
 * Type Guard: Safely checks if an incoming generic message is an `OffscreenClassifyImageRequest`
 */
export function isOffscreenClassifyImageRequest(
  message: unknown
): message is OffscreenClassifyImageRequest {
  return hasMessageType(message, CLASSIFY_IMAGE_OFFSCREEN_MESSAGE);
}