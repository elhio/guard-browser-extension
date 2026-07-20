import { browser } from 'wxt/browser';

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

/**
 * Checks if the Chrome/Manifest V3 offscreen document is currently active
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

let creatingOffscreenDocument: Promise<void> | undefined;

/**
 * Ensures the Chrome offscreen document exists and is ready to be messaged.
 *
 * This is Chrome-only: its DOM-less MV3 service worker can't run the C2PA/model work, so it is
 * offloaded to an offscreen document. Firefox has a DOM-backed background page and classifies
 * inline instead, so it never calls this (the caller gates it behind `import.meta.env.FIREFOX`).
 *
 * @returns A promise that resolves once the offscreen document is ready
 */
export async function ensureOffscreenDocument(): Promise<void> {
  if (!browser.offscreen) return;
  if (await hasChromeOffscreenDocument()) return;

  // Cache the creation promise so concurrent callers don't create it twice.
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = browser.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [browser.offscreen.Reason.WORKERS],
        justification: 'Read C2PA metadata from images using the C2PA SDK, which needs a worker.'
      })
      .finally(() => {
        creatingOffscreenDocument = undefined;
      });
  }

  await creatingOffscreenDocument;
}
