/**
 * The unique identifier used to route API verification messages through the extension's messaging system
 */
export const EXTERNAL_API_VERIFY_MESSAGE = 'EXTERNAL_API_VERIFY_MESSAGE';

/**
 * The payload sent from the Content Script (or Popup) to the Background Script
 *
 * @property type - The unique routing identifier for this message (`EXTERNAL_API_VERIFY_MESSAGE`)
 * @property src - The absolute URL of the image that needs to be verified by the external API
 */
export interface ExternalApiVerifyRequest {
  type: typeof EXTERNAL_API_VERIFY_MESSAGE;
  src: string;
}

/**
 * The shape of the data returned by your external API

 * @property probability - The confidence score indicating how likely the content is AI-generated or matches a specific classification
 * @property isLikelyAiGenerated - A boolean flag confirming if the probability meets the API's internal threshold for AI generation
 */
export interface ExternalApiData {
  probability?: number;
  isLikelyAiGenerated?: boolean;
  [key: string]: any;
}

/**
 * The response sent back from the background script to the content script, which uses a discriminated union to
 * guarantee type safety for error handling
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
 * Type Guard: Used by the background script to safely check if an incoming generic message is specifically an
 * `ExternalApiVerifyRequest`
 *
 * @param message - The unknown message payload received by the background script listener
 * @returns True if the message matches the `ExternalApiVerifyRequest` shape, narrowing the type for TypeScript
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