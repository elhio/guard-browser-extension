/**
 * The unique identifier used to route API verification messages through the extension's messaging system
 */
export const VERIFY_IMAGE_MESSAGE = 'VERIFY_IMAGE_MESSAGE';

/**
 * The payload sent from the Content Script (or Popup) to the Background Script
 *
 * @property type - The unique routing identifier for this message (`VERIFY_IMAGE_MESSAGE`)
 * @property src - The absolute URL of the image that needs to be verified by the external API
 */
export interface VerifyImageRequest {
  type: typeof VERIFY_IMAGE_MESSAGE;
  src: string;
}

/**
 * The shape of the data returned by your external API
 *
 * @property aiGenerated - The confidence score indicating how likely the content is AI-generated or matches a specific classification
 * @property violent - The confidence score indicating how likely the content is violent
 * @property explicit -The confidence score indicating how likely the content is sexually explicit
 */
export interface VerifyImageData {
  aiGenerated?: number;
  violent?: number;
  explicit?: number;
  [key: string]: any;
}

/**
 * The response sent back from the background script to the content script, which uses a discriminated union to
 * guarantee type safety for error handling
 */
export type VerifyImageResponse =
  | {
      success: true;
      data: VerifyImageData;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Type Guard: Used by the background script to safely check if an incoming generic message is specifically an
 * `ExternalApiVerifyRequest`
 *
 * @param message - The unknown message payload received by the background script listener
 * @returns True if the message matches the `ExternalApiVerifyRequest` shape, narrowing the type for TypeScript
 */
export function isVerifyImageRequest(
  message: unknown
): message is VerifyImageRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as Record<string, unknown>).type === VERIFY_IMAGE_MESSAGE &&
    'src' in message &&
    typeof (message as Record<string, unknown>).src === 'string'
  );
}