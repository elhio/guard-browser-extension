import { browser } from 'wxt/browser';

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
const OFFSCREEN_IFRAME_ID = 'guard-offscreen-frame';

/**
 * Checks if a Chrome/Manifest V3 offscreen document is currently active
 *
 * @returns True if the offscreen document is already running, otherwise false
 */
async function hasChromeOffscreenDocument(): Promise<boolean> {
  if (!browser.runtime.getContexts) return false;

  const contexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return contexts.length > 0;
}

let creatingWorkerPage: Promise<void> | undefined;

/**
 * Ensures that the offscreen document environment is initialized and ready
 *
 * Note: This function seamlessly handles cross-browser differences:
 * - On Chrome (MV3): Uses the native `browser.offscreen` API
 * - On Firefox / Legacy Contexts: Falls back to injecting a hidden iframe into the DOM
 *
 * @returns A promise that resolves when the offscreen document is fully initialized and ready
 */
export async function ensureOffscreenDocument(): Promise<void> {
  if (browser.offscreen) {
    if (await hasChromeOffscreenDocument()) return;

    // Prevent race conditions by caching the creation promise
    if (!creatingWorkerPage) {
      creatingWorkerPage = browser.offscreen
        .createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: [browser.offscreen.Reason.WORKERS],
          justification:
            'Read C2PA metadata from images using the C2PA SDK, which needs a worker.'
        })
        .finally(() => {
          // Clear the lock once settled so future calls check the context again
          creatingWorkerPage = undefined;
        });
    }

    await creatingWorkerPage;
    return;
  }

  if (document.getElementById(OFFSCREEN_IFRAME_ID)) return;

  const iframe = document.createElement('iframe');
  iframe.id = OFFSCREEN_IFRAME_ID;
  iframe.hidden = true;
  iframe.src = browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  document.body.appendChild(iframe);
}