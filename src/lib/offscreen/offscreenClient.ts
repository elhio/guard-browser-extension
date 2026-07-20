import { browser } from 'wxt/browser';
import type { SerializableImageCandidate } from '@/lib/images';
import type { TasksState } from '@/lib/detection';
import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import {
  isOffscreenIframeReply,
  type OffscreenIframeRequest
} from '@/lib/messaging/offscreenIframeMessages';

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
const OFFSCREEN_IFRAME_ID = 'guard-offscreen-frame';
/** Fail a request if the iframe never replies, so a lost message doesn't leak a pending entry. */
const REPLY_TIMEOUT_MS = 60_000;

/**
 * Firefox-only offscreen client. The background page (which has a DOM but no `browser.offscreen`
 * API) hosts `/offscreen.html` in a hidden iframe and drives classification over `window.postMessage`
 * — the reliable same-origin parent↔child channel. `runtime.sendMessage` can't be used here because
 * Firefox won't route its response back out of a background-page sub-frame.
 *
 * Keeping the heavy work in the offscreen page (an ESM document) also avoids pulling transformers.js
 * into the IIFE-bundled background, where its `import.meta.url` breaks and the WASM would be inlined.
 */

let iframeReady: Promise<HTMLIFrameElement> | undefined;

/** Lazily creates the hidden offscreen iframe and resolves once it has loaded. */
function ensureIframe(): Promise<HTMLIFrameElement> {
  if (!iframeReady) {
    iframeReady = new Promise<HTMLIFrameElement>((resolve, reject) => {
      const existing = document.getElementById(OFFSCREEN_IFRAME_ID);
      if (existing instanceof HTMLIFrameElement) {
        resolve(existing);
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.id = OFFSCREEN_IFRAME_ID;
      // Render off-screen rather than `hidden`/`display:none` so the document isn't throttled.
      iframe.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
      iframe.src = browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
      // Resolve only after load, i.e. after the iframe's message listener is registered.
      iframe.addEventListener('load', () => resolve(iframe), { once: true });
      iframe.addEventListener('error', () => reject(new Error('Offscreen iframe failed to load')), {
        once: true
      });
      (document.body ?? document.documentElement).appendChild(iframe);
    }).catch((error) => {
      // Let a later call retry after a load failure.
      iframeReady = undefined;
      throw error;
    });
  }
  return iframeReady;
}

let nextRequestId = 0;
const pending = new Map<number, (results: ClassifyImageResult[]) => void>();
let listening = false;

/** Registers the single window listener that resolves pending requests as replies arrive. */
function startListening(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('message', (event) => {
    if (!isOffscreenIframeReply(event.data)) return;
    const resolve = pending.get(event.data.id);
    if (resolve) {
      pending.delete(event.data.id);
      resolve(event.data.results);
    }
  });
}

/**
 * Runs classification for a batch of candidates in the offscreen iframe and returns its results.
 *
 * @throws {Error} If the iframe fails to load or does not reply within {@link REPLY_TIMEOUT_MS}.
 */
export async function classifyViaOffscreenIframe(
  candidates: SerializableImageCandidate[],
  tasks: TasksState,
  useDetectorLocalModel: boolean
): Promise<ClassifyImageResult[]> {
  startListening();
  const iframe = await ensureIframe();
  const id = nextRequestId++;

  const reply = new Promise<ClassifyImageResult[]>((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error('Offscreen classification timed out'));
    }, REPLY_TIMEOUT_MS);
  });

  const request: OffscreenIframeRequest = {
    __guardOffscreenRequest: true,
    id,
    candidates,
    tasks,
    useDetectorLocalModel
  };
  iframe.contentWindow?.postMessage(request, '*');

  return reply;
}
