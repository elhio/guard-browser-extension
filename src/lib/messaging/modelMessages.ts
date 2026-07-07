/**
 * The unique identifier used by content scripts to request local model classification
 * for a specific image via the background script
 */
export const CLASSIFY_IMAGE_MESSAGE = 'guard:classify-image' as const;

/**
 * The unique identifier used by the background script to forward model classification
 * tasks to an offscreen document
 *
 */
export const OFFSCREEN_CLASSIFY_IMAGE_MESSAGE = 'guard:offscreen-classify-image' as const;

/**
 * The payload sent from the content script to request AI classification for a single image
 *
 * @property type - The routing identifier for this message (`CLASSIFY_IMAGE_MESSAGE`)
 * @property src - The absolute URL of the image to be classified
 */
export interface ClassifyImageRequest {
  type: typeof CLASSIFY_IMAGE_MESSAGE;
  src: string;
}

/**
 * The payload forwarded by the background script to the offscreen document for processing
 *
 * @property type - The routing identifier for this message (`OFFSCREEN_CLASSIFY_IMAGE_MESSAGE`)
 * @property src - The absolute URL of the image to be classified within the offscreen context
 */
export interface OffscreenClassifyImageRequest {
  type: typeof OFFSCREEN_CLASSIFY_IMAGE_MESSAGE;
  src: string;
}

/**
 * The response payload returned after attempting to run inference on an image.
 * @property aiScore - The probability (0.0 to 1.0) that the image is AI-generated, or null if the model couldn't confidently map the output
 * @property error - An optional descriptive message if the classification attempt failed
 */
export interface ClassifyImageResponse {
  aiScore: number | null;
  error?: string;
}

/**
 * Internal helper to safely verify if an unknown message object contains a specific 'type' property
 *
 * @param message - The unknown payload to inspect
 * @param type - The expected message type string
 * @returns True if the message is an object containing the matching type property
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
 *
 * @param message - The unknown message payload received by a listener
 * @returns True if the message matches the request shape, narrowing its type
 */
export function isClassifyImageRequest(message: unknown): message is ClassifyImageRequest {
  return hasMessageType(message, CLASSIFY_IMAGE_MESSAGE);
}

/**
 * Type Guard: Safely checks if an incoming generic message is an `OffscreenClassifyImageRequest`
 *
 * @param message - The unknown message payload received by the offscreen document listener
 * @returns True if the message matches the request shape, narrowing its type
 */
export function isOffscreenClassifyImageRequest(message: unknown): message is OffscreenClassifyImageRequest {
  return hasMessageType(message, OFFSCREEN_CLASSIFY_IMAGE_MESSAGE);
}