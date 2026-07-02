export const EXTERNAL_API_VERIFY_MESSAGE = 'EXTERNAL_API_VERIFY_MESSAGE';

/**
 * The payload sent from the Content Script (or Popup) to the Background Script.
 */
export interface ExternalApiVerifyRequest {
  type: typeof EXTERNAL_API_VERIFY_MESSAGE;
  src: string; // The URL of the image to verify
}

/**
 * The shape of the data returned by your external API.
 * Update these fields to match exactly what your backend returns!
 */
export interface ExternalApiData {
  probability?: number;
  isLikelyAiGenerated?: boolean;
  // Add any other metadata your API provides
  [key: string]: any;
}

/**
 * The response sent back from the Background Script to the Content Script.
 * Uses a discriminated union to guarantee type safety for error handling.
 */
export type ExternalApiVerifyResponse =
  | {
      success: true;
      data: ExternalApiData;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Type Guard: Used by the background script to safely check if an incoming
 * generic message is actually an ExternalApiVerifyRequest.
 */
export function isExternalApiVerifyRequest(
  message: unknown
): message is ExternalApiVerifyRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as Record<string, unknown>).type === EXTERNAL_API_VERIFY_MESSAGE &&
    'src' in message &&
    typeof (message as Record<string, unknown>).src === 'string'
  );
}