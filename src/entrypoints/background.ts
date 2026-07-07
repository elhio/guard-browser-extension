import { ensureOffscreenDocument } from '@/lib/offscreen/ensureOffscreenDocument';
import {
  isClassifyImageRequest,
  CLASSIFY_IMAGE_OFFSCREEN_MESSAGE,
  type OffscreenClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/classifyMessages';
import {
  isVerifyImageRequest,
  type VerifyImageResponse
} from '@/lib/messaging/verifyMessages';

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
    // PATH 1: classification
    if (isClassifyImageRequest(message)) {
      (async () => {
        try {
          await ensureOffscreenDocument();

          const request: OffscreenClassifyImageRequest = {
            type: CLASSIFY_IMAGE_OFFSCREEN_MESSAGE,
            candidates: message.candidates,
            tasks: message.tasks,
            useDetectorLocalModel: message.useDetectorLocalModel
          };

          const response = (await browser.runtime.sendMessage(request)) as ClassifyImageResponse;
          sendResponse(response);
        } catch (error) {
          // If the offscreen document crashes entirely, safely fail all candidates
          // so the content script doesn't hang waiting for a response
          const fallbackResponse: ClassifyImageResponse = {
            results: message.candidates.map((c) => ({
              status: 'error',
              src: c.src,
              error: String(error)
            }))
          };
          sendResponse(fallbackResponse);
        }
      })();
      return true;
    }

    // PATH 2: external verification
    if (isVerifyImageRequest(message)) {
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

          const response: VerifyImageResponse = { success: true, data };
          sendResponse(response);
        } catch (error) {
          const fallbackResponse: VerifyImageResponse = {
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