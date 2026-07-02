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
import {
  isExternalApiVerifyRequest,
  type ExternalApiVerifyResponse
} from '@/lib/messaging/apiMessages';


export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      const storage = await browser.storage.local.get('hasCompletedSetup');

      if (!storage.hasCompletedSetup) {
        browser.tabs.create({
          url: browser.runtime.getURL('/setup.html')
        });
      }
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // PATH 1: C2PA + embedded-metadata reading
    if (isReadC2paManifestsRequest(message)) {
      (async () => {
        try {
          await ensureOffscreenDocument();
          const request: OffscreenReadC2paManifestsRequest = {
            type: OFFSCREEN_READ_C2PA_MANIFESTS_MESSAGE,
            candidates: message.candidates
          };
          const response = (await browser.runtime.sendMessage(request)) as ReadC2paManifestsResponse;
          sendResponse(response);
        } catch (error) {
          sendResponse({ error: String(error) });
        }
      })();
      return true;
    }

    // PATH 2: Local model classification
    if (isClassifyImageRequest(message)) {
      (async () => {
        try {
          await ensureOffscreenDocument();
          const request: OffscreenClassifyImageRequest = {
            type: OFFSCREEN_CLASSIFY_IMAGE_MESSAGE,
            src: message.src
          };
          const response = (await browser.runtime.sendMessage(request)) as ClassifyImageResponse;
          sendResponse(response);
        } catch (error) {
          sendResponse({ error: String(error) });
        }
      })();
      return true;
    }

    // PATH 3: External API "deep scan"
    if (isExternalApiVerifyRequest(message)) {
      (async () => {
        try {
          const baseUrl = import.meta.env.WXT_API_URL;

          const res = await fetch(`${baseUrl}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ src: message.src })
          });

          if (!res.ok) throw new Error(`API returned status: ${res.status}`);

          const data = await res.json();

          const response: ExternalApiVerifyResponse = { success: true, data };
          sendResponse(response);
        } catch (error) {
          const fallbackResponse: ExternalApiVerifyResponse = {
            success: false,
            error: String(error)
          };
          sendResponse(fallbackResponse);
        }
      })();
      return true;
    }

    return undefined;
  });
});