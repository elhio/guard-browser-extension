import { ensureOffscreenDocument } from '../lib/offscreen/ensureOffscreenDocument';
import {
  isReadC2paManifestsRequest,
  OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE,
  type OffscreenReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '../lib/messaging/c2paMessages';

// The background script never touches the C2PA SDK directly — it only relays
// requests to the offscreen page that actually owns it (see ensureOffscreenDocument
// for why: the SDK needs a Worker, which a Chrome MV3 service worker can't spawn).
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isReadC2paManifestsRequest(message)) return;

    (async () => {
      await ensureOffscreenDocument();
      const request: OffscreenReadC2paManifestsRequest = {
        type: OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE,
        candidates: message.candidates
      };
      const response: ReadC2paManifestsResponse = await browser.runtime.sendMessage(request);
      sendResponse(response);
    })();

    // Returning true keeps the message channel open for the async sendResponse above.
    return true;
  });
});
