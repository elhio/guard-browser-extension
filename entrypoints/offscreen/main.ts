import { readManifests } from '@/lib/c2pa';
import {
  isOffscreenReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '@/lib/messaging/c2paMessages';
import {
  isOffscreenClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/modelMessages';

// This single offscreen document hosts everything that needs a Worker / WASM
// under the extension's own CSP (a Chrome MV3 service-worker background can't):
//   1. C2PA + embedded-metadata reading (the always-on main detection path).
//   2. The local fallback model, imported on demand so its heavy bundle is only
//      pulled when the user actually requests a local analysis.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isOffscreenReadC2paManifestsRequest(message)) {
    readManifests(message.candidates).then((results) => {
      sendResponse({ results } satisfies ReadC2paManifestsResponse);
    });
    return true;
  }

  if (isOffscreenClassifyImageRequest(message)) {
    (async () => {
      try {
        const { classifyImageAiScore } = await import('@/lib/localModel/runner');
        const aiScore = await classifyImageAiScore(message.src);
        sendResponse({ aiScore } satisfies ClassifyImageResponse);
      } catch (error) {
        sendResponse({
          aiScore: null,
          error: error instanceof Error ? error.message : String(error)
        } satisfies ClassifyImageResponse);
      }
    })();
    return true;
  }

  return undefined;
});
