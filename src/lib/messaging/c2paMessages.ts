import type { SerializableImageCandidate } from '@/lib/images';
import type { C2paReadResult } from '@/lib/c2pa';

/**
 * Content scripts send their scanned candidates to the background script with
 * this message and get manifest read results back.
 */
export const READ_C2PA_MANIFESTS_MESSAGE = 'guard:read-c2pa-manifests' as const;

/**
 * The C2PA SDK needs to spawn a Worker, which a Chrome MV3 service worker
 * background can't do itself. When that's the case, the background script
 * forwards the request to an offscreen document (a regular page context)
 * using this message instead of handling it directly.
 */
export const OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE =
  'guard:offscreen-read-c2pa-manifests' as const;

export interface ReadC2paManifestsResponse {
  results: C2paReadResult[];
}

export interface ReadC2paManifestsRequest {
  type: typeof READ_C2PA_MANIFESTS_MESSAGE;
  candidates: SerializableImageCandidate[];
}

export interface OffscreenReadC2paManifestsRequest {
  type: typeof OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE;
  candidates: SerializableImageCandidate[];
}

function hasMessageType(message: unknown, type: string): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === type
  );
}

export function isReadC2paManifestsRequest(
  message: unknown
): message is ReadC2paManifestsRequest {
  return hasMessageType(message, READ_C2PA_MANIFESTS_MESSAGE);
}

export function isOffscreenReadC2paManifestsRequest(
  message: unknown
): message is OffscreenReadC2paManifestsRequest {
  return hasMessageType(message, OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE);
}