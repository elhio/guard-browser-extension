import { browser } from 'wxt/browser';
import {
  isOffscreenClassifyImageRequest,
  type ClassifyImageResponse,
  type ClassifyImageResult
} from '@/lib/messaging/classifyMessages';
import {
  isOffscreenIframeRequest,
  type OffscreenIframeReply
} from '@/lib/messaging/offscreenIframeMessages';
import { respondAsync } from '@/lib/messaging/respondAsync';
import { classifyCandidates } from '@/lib/classify/classifyCandidates';

// This page hosts the heavy C2PA + model work off the DOM-less/IIFE background:
// - Chrome: it's a real offscreen document, messaged via `runtime.sendMessage`.
// - Firefox: it's an iframe in the background page, driven over `window.postMessage` (Firefox
//   can't return a runtime message response out of a background sub-frame).
if (import.meta.env.FIREFOX) {
  window.addEventListener('message', (event) => {
    const request = event.data;
    if (!isOffscreenIframeRequest(request)) return;

    void (async () => {
      let results: ClassifyImageResult[];
      try {
        results = await classifyCandidates(
          request.candidates,
          request.tasks,
          request.useDetectorLocalModel
        );
      } catch (error) {
        results = request.candidates.map((c) => ({
          status: 'error',
          src: c.src,
          error: error instanceof Error ? error.message : String(error)
        }));
      }

      const reply: OffscreenIframeReply = {
        __guardOffscreenReply: true,
        id: request.id,
        results
      };
      // The parent is the background page that hosts this iframe; reply straight to it.
      window.parent.postMessage(reply, '*');
    })();
  });
} else {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isOffscreenClassifyImageRequest(message)) {
      const work = (async (): Promise<ClassifyImageResponse> => {
        try {
          const results = await classifyCandidates(
            message.candidates,
            message.tasks,
            message.useDetectorLocalModel
          );
          return { results };
        } catch (error) {
          return {
            results: message.candidates.map((c) => ({
              status: 'error',
              src: c.src,
              error: error instanceof Error ? error.message : String(error)
            }))
          };
        }
      })();
      return respondAsync(work, sendResponse);
    }

    return undefined;
  });
}
