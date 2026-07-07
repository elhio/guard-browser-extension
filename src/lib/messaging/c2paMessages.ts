import type { SerializableImageCandidate } from '@/lib/images';
import type { C2paReadResult } from '@/lib/c2pa';

/**
 * The unique identifier used by content scripts to send scanned image candidates
 * to the background script for C2PA manifest extraction
 */
export const READ_C2PA_MANIFESTS_MESSAGE = 'guard:read-c2pa-manifests' as const;

/**
 * The unique identifier used by the background script to forward C2PA reading tasks
 * to an offscreen document
 */
export const OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE =
  'guard:offscreen-read-c2pa-manifests' as const;

/**
 * The payload returned after attempting to read C2PA manifests for a batch of images
 *
 * @property results - An array containing the success or error states for each processed image candidate
 */
export interface ReadC2paManifestsResponse {
  results: C2paReadResult[];
}

/**
 * The message payload sent from the content script to request C2PA manifest extraction
 *
 * @property type - The routing identifier for this message (`READ_C2PA_MANIFESTS_MESSAGE`)
 * @property candidates - An array of serializable image candidates (DOM elements stripped) to be analyzed
 */
export interface ReadC2paManifestsRequest {
  type: typeof READ_C2PA_MANIFESTS_MESSAGE;
  candidates: SerializableImageCandidate[];
}

/**
 * The message payload forwarded by the background script to the offscreen document
 *
 * @property type - The routing identifier for this message (`OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE`)
 * @property candidates - An array of serializable image candidates to be analyzed within the offscreen context
 */
export interface OffscreenReadC2paManifestsRequest {
  type: typeof OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE;
  candidates: SerializableImageCandidate[];
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
 * Type Guard: Safely checks if an incoming generic message is a standard `ReadC2paManifestsRequest`
 *
 * @param message - The unknown message payload received by a listener
 * @returns True if the message matches the request shape, narrowing its type for TypeScript
 */
export function isReadC2paManifestsRequest(
  message: unknown
): message is ReadC2paManifestsRequest {
  return hasMessageType(message, READ_C2PA_MANIFESTS_MESSAGE);
}

/**
 * Type Guard: Safely checks if an incoming generic message is an `OffscreenReadC2paManifestsRequest`
 *
 * @param message - The unknown message payload received by the offscreen document listener
 * @returns True if the message matches the request shape, narrowing its type for TypeScript
 */
export function isOffscreenReadC2paManifestsRequest(
  message: unknown
): message is OffscreenReadC2paManifestsRequest {
  return hasMessageType(message, OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE);
}