/**
 * Content scripts ask the background to run the local fallback model on a
 * single image (by src) with this message and get an AI-probability back.
 */
export const CLASSIFY_IMAGE_MESSAGE = 'guard:classify-image' as const;

/**
 * The model runs in the offscreen document (it needs a Worker / WASM, which a
 * Chrome MV3 service worker can't host). The background forwards the request
 * there with this message instead of handling it directly.
 */
export const OFFSCREEN_CLASSIFY_IMAGE_MESSAGE = 'guard:offscreen-classify-image' as const;

export interface ClassifyImageRequest {
  type: typeof CLASSIFY_IMAGE_MESSAGE;
  src: string;
}

export interface OffscreenClassifyImageRequest {
  type: typeof OFFSCREEN_CLASSIFY_IMAGE_MESSAGE;
  src: string;
}

export interface ClassifyImageResponse {
  /** Probability the image is AI-generated (0-1), or null if the model couldn't decide. */
  aiScore: number | null;
  error?: string;
}

function hasMessageType(message: unknown, type: string): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === type
  );
}

export function isClassifyImageRequest(message: unknown): message is ClassifyImageRequest {
  return hasMessageType(message, CLASSIFY_IMAGE_MESSAGE);
}

export function isOffscreenClassifyImageRequest(message: unknown): message is OffscreenClassifyImageRequest {
  return hasMessageType(message, OFFSCREEN_CLASSIFY_IMAGE_MESSAGE);
}