import type { DetectionCategory } from '@/lib/detection';

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
 * A single scored result from the external verification API
 *
 * @property taskId - The id of the detection task this score belongs to
 * @property category - The detection category this task maps to, resolved from the space's
 *   task list (null when the task doesn't correspond to a known category)
 * @property label - The human-readable, already-localized outcome label (e.g. "No signs of AI generation")
 * @property score - The confidence score for this task, 0-100
 * @property description - An optional localized explanation of the result
 */
export interface VerifyResultItem {
  taskId: string;
  category: DetectionCategory | null;
  label: string;
  score: number;
  description?: string;
  /** Predefined "expected result" reactions for this task: integer key → label. */
  reactions?: Record<number, string>;
}

/**
 * The data returned by the external verification API: one scored item per detection
 * task the verifying space runs (the set of tasks is space-specific, not a fixed trio).
 *
 * @property activityId - The created activity's id, needed to submit feedback / create a share
 */
export interface VerifyImageData {
  activityId: string;
  results: VerifyResultItem[];
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