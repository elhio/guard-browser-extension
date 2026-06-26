import { readManifests } from '../../lib/c2pa';
import {
  isOffscreenReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '../../lib/messaging/c2paMessages';

// This page runs as an offscreen document so the C2PA SDK can spawn its Worker
// (Chrome MV3's service-worker background can't) under the extension's own CSP
// (so WASM compilation isn't blocked by the host page's CSP).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOffscreenReadC2paManifestsRequest(message)) return;

  readManifests(message.candidates).then((results) => {
    sendResponse({ results } satisfies ReadC2paManifestsResponse);
  });

  return true;
});
