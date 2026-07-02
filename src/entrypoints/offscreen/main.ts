import { browser } from 'wxt/browser';
import { readManifests } from '@/lib/c2pa';
import {
  isOffscreenReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '@/lib/messaging/c2paMessages';
import {
  isOffscreenClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/modelMessages';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // PATH 1: C2PA Manifests
  if (isOffscreenReadC2paManifestsRequest(message)) {
    (async () => {
      try {
        const results = await readManifests(message.candidates);
        sendResponse({ results } satisfies ReadC2paManifestsResponse);
      } catch (error) {
        console.error('[Offscreen] C2PA Error:', error);
        // always send a response so the background script doesn't hang
        sendResponse({
          results: [],
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
    return true; // keep channel open
  }

  // PATH 2: Local AI Model
  if (isOffscreenClassifyImageRequest(message)) {
    (async () => {
      try {
        const { classifyImageAiScore } = await import('@/lib/localModel/runner');
        const aiScore = await classifyImageAiScore(message.src);

        sendResponse({ aiScore } satisfies ClassifyImageResponse);
      } catch (error) {
        console.error('[Offscreen] Model Error:', error);
        sendResponse({
          aiScore: null,
          error: error instanceof Error ? error.message : String(error)
        } satisfies ClassifyImageResponse);
      }
    })();
    return true; // keep channel open
  }

  return undefined;
});