const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
const OFFSCREEN_IFRAME_ID = 'guard-offscreen-frame';

async function hasChromeOffscreenDocument(): Promise<boolean> {
  if (!chrome.runtime.getContexts) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return contexts.length > 0;
}

let creatingWorkerPage: Promise<void> | undefined;

/**
 * Ensures the page that hosts the C2PA SDK (and the Worker it needs) is running.
 *
 * - Chrome MV3: the background is a service worker with no DOM and no Worker
 *   constructor, so we use `chrome.offscreen` to spin up a dedicated document.
 * - Firefox MV2: the background is a regular page with a DOM, so we just embed
 *   the same offscreen.html in a hidden iframe instead.
 *
 * Safe to call repeatedly/concurrently — the page is only ever created once.
 */
export async function ensureOffscreenDocument(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    if (await hasChromeOffscreenDocument()) return;

    if (!creatingWorkerPage) {
      creatingWorkerPage = chrome.offscreen
        .createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: [chrome.offscreen.Reason.WORKERS],
          justification:
            'Read C2PA metadata from images using the C2PA SDK, which needs a Worker.'
        })
        .finally(() => {
          creatingWorkerPage = undefined;
        });
    }

    await creatingWorkerPage;
    return;
  }

  // Firefox MV2 fallback: embed the same page in a hidden iframe on the
  // background page's own DOM instead of using the (Chrome-only) offscreen API.
  if (document.getElementById(OFFSCREEN_IFRAME_ID)) return;

  const iframe = document.createElement('iframe');
  iframe.id = OFFSCREEN_IFRAME_ID;
  iframe.hidden = true;
  iframe.src = browser.runtime.getURL('/offscreen.html');
  document.body.appendChild(iframe);
}
