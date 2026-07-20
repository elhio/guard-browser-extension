import type { SerializableImageCandidate } from '@/lib/images';
import type { TasksState } from '@/lib/detection';
import type { ClassifyImageResult } from './classifyMessages';

/**
 * Messages exchanged over `window.postMessage` between the Firefox background page and the offscreen
 * iframe it hosts. Firefox can't return a `runtime.sendMessage` response out of a background-page
 * sub-frame, so classification requests/replies ride the same-origin DOM message channel instead.
 */
export interface OffscreenIframeRequest {
  __guardOffscreenRequest: true;
  id: number;
  candidates: SerializableImageCandidate[];
  tasks: TasksState;
  useDetectorLocalModel: boolean;
}

export interface OffscreenIframeReply {
  __guardOffscreenReply: true;
  id: number;
  results: ClassifyImageResult[];
}

/** Type guard for a classification request received inside the offscreen iframe. */
export function isOffscreenIframeRequest(data: unknown): data is OffscreenIframeRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as OffscreenIframeRequest).__guardOffscreenRequest === true &&
    typeof (data as OffscreenIframeRequest).id === 'number'
  );
}

/** Type guard for a reply received back in the background page. */
export function isOffscreenIframeReply(data: unknown): data is OffscreenIframeReply {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as OffscreenIframeReply).__guardOffscreenReply === true &&
    typeof (data as OffscreenIframeReply).id === 'number'
  );
}
