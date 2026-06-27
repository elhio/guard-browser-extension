import { ensureOffscreenDocument } from '@/lib/offscreen/ensureOffscreenDocument';
import {
  isReadC2paManifestsRequest,
  OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE,
  type OffscreenReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '@/lib/messaging/c2paMessages';
import {
  isClassifyImageRequest,
  OFFSCREEN_CLASSIFY_IMAGE_MESSAGE,
  type OffscreenClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/modelMessages';

// The background script never touches the C2PA SDK or the local model directly —
// it only relays content-script requests to the offscreen document that owns
// them (see ensureOffscreenDocument for why: both need a Worker, which a Chrome
// MV3 service worker can't spawn).
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Main path: C2PA + embedded-metadata reading for a batch of images.
    if (isReadC2paManifestsRequest(message)) {
      (async () => {
        await ensureOffscreenDocument();
        const request: OffscreenReadC2paManifestsRequest = {
          type: OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE,
          candidates: message.candidates
        };
        const response = (await browser.runtime.sendMessage(request)) as ReadC2paManifestsResponse;
        sendResponse(response);
      })();
      return true;
    }

    // Fallback path: run the local model on a single image on user request.
    if (isClassifyImageRequest(message)) {
      (async () => {
        await ensureOffscreenDocument();
        const request: OffscreenClassifyImageRequest = {
          type: OFFSCREEN_CLASSIFY_IMAGE_MESSAGE,
          src: message.src
        };
        const response = (await browser.runtime.sendMessage(request)) as ClassifyImageResponse;
        sendResponse(response);
      })();
      return true;
    }

    // Returning true keeps the channel open for the async sendResponse above.
    return undefined;
  });
});
