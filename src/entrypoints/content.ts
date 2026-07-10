import { browser } from 'wxt/browser';
import { createElement } from 'react';
import ReactDOM from 'react-dom/client';

import '@/assets/tailwind.css';
import { BadgeMenu } from '@/components/overlay/BadgeMenu';
import {
  byHttpSource,
  bySupportedFormat,
  byMinRenderedSize,
  toSerializableCandidate,
  watchPageImages
} from '@/lib/images';
import type { ImageCandidate } from '@/lib/images';
import {
  CLASSIFY_IMAGE_MESSAGE,
  isClassifyResultPush,
  type ClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/classifyMessages';
import {
  VERIFY_IMAGE_MESSAGE,
  type VerifyImageRequest,
  type VerifyImageResponse
} from '@/lib/messaging/verifyMessages';

import {
  applyAction,
  clearAllBadges,
  clearAllActions,
  clearOverlayState,
  coverWhileProcessing,
  revealAfterProcessing,
  setAction,
  setVerifyTransport,
  updateSettings,
  markBadgesProcessing,
  showBadgeError,
  updateBadges,
  type OverlaySettings,
} from '@/lib/overlay';

import { settings, type Settings } from '@/lib/settings';
import { t } from '@/lib/i18n';

/** Max images classified in parallel (bounds concurrent fetch/metadata/C2PA work). */
const CLASSIFY_CONCURRENCY = 4;
/**
 * Skip images smaller than this (larger side, CSS pixels): icons, bullets, spacers, and tracking
 * pixels are too small for a viewer to perceive AI/violent/explicit content and waste analysis.
 */
const MIN_IMAGE_SIZE_PX = 64;
/**
 * Give up on a single image's classification after this long and mark it failed. The local model
 * runs single-threaded WASM (no SharedArrayBuffer in the offscreen context) and inferences are
 * serialized through one session, so this budget must cover queued heavy inference, not just metadata.
 */
const CLASSIFY_TIMEOUT_MS = 40_000;

async function processCandidates(candidates: ImageCandidate[]): Promise<void> {
  const currentSettings = await settings.getValue();
  const elementsBySrc = new Map(candidates.map((candidate) => [candidate.src, candidate.element]));

  markBadgesProcessing(candidates, elementsBySrc);

  // With a blur/hide action, cover images up front so unclassified content isn't shown before it's
  // known to be safe; each one is revealed (or kept covered if flagged) once its result arrives.
  for (const candidate of candidates) {
    const element = elementsBySrc.get(candidate.src);
    if (element) coverWhileProcessing(element);
  }

  // Classify each image independently so every badge updates as soon as its own result
  // arrives, and one slow/failed image never blocks or fails the others.
  await runWithConcurrency(candidates, CLASSIFY_CONCURRENCY, (candidate) =>
    classifyCandidate(candidate, currentSettings, elementsBySrc)
  );
}

/**
 * Firefox delivers the classification result by pushing a `CLASSIFY_RESULT_MESSAGE` from the
 * background (`tabs.sendMessage`) rather than as a `runtime.sendMessage` response, which it doesn't
 * reliably return to a content-script sender. These resolve the awaiting request by id.
 */
const pendingClassifications = new Map<string, (response: ClassifyImageResponse) => void>();
if (import.meta.env.FIREFOX) {
  browser.runtime.onMessage.addListener((message, sender) => {
    // The result is pushed by our background page, which has no `sender.tab`. Reject anything that
    // carries a tab (i.e. came from another content-script frame) so a page can't inject fake
    // results by guessing a requestId.
    if (sender.tab) return;
    if (!isClassifyResultPush(message)) return;
    const resolve = pendingClassifications.get(message.requestId);
    if (resolve) {
      pendingClassifications.delete(message.requestId);
      resolve({ results: message.results });
    }
  });
}

/** Sends a classification request and resolves with its result, per-browser transport. */
function requestClassification(request: ClassifyImageRequest): Promise<ClassifyImageResponse> {
  if (import.meta.env.FIREFOX) {
    // Fire the request and wait for the background to push the result back by id.
    const result = new Promise<ClassifyImageResponse>((resolve) => {
      pendingClassifications.set(request.requestId, resolve);
    });
    void browser.runtime.sendMessage(request);
    return result;
  }
  // Chrome: the background returns the result as the message response.
  return browser.runtime.sendMessage(request) as Promise<ClassifyImageResponse>;
}

async function classifyCandidate(
  candidate: ImageCandidate,
  currentSettings: Settings,
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): Promise<void> {
  const element = elementsBySrc.get(candidate.src);
  const request: ClassifyImageRequest = {
    type: CLASSIFY_IMAGE_MESSAGE,
    requestId: crypto.randomUUID(),
    candidates: [toSerializableCandidate(candidate)],
    tasks: currentSettings.tasks,
    useDetectorLocalModel: currentSettings.useDetectorLocalModel
  };

  try {
    const response = await withTimeout(requestClassification(request), CLASSIFY_TIMEOUT_MS);

    const result = response?.results?.[0];
    if (!result) {
      if (element) showBadgeError(candidate.src, element, t('badge_error_analyze'));
      return;
    }

    // updateBadges handles a per-image error result (gray ring) itself; the menu decides
    // whether to offer Verify from the settings snapshot pushed to the store.
    updateBadges([result], elementsBySrc);
    applyAction([result], elementsBySrc);
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'timeout';
    if (element) showBadgeError(candidate.src, element, timedOut ? t('badge_error_timeout') : t('badge_error_analyze'));
  } finally {
    // Drop the pending entry (no-op on Chrome / already-resolved requests).
    pendingClassifications.delete(request.requestId);
    // Reveal the image unless it was flagged (applyAction ran above); no-op for the 'mark' action
    // and for images that were never covered. Runs on success, empty, and error/timeout paths.
    if (element) revealAfterProcessing(element);
  }
}

/** Projects the full settings object down to what the menu store needs. */
function toOverlaySettings(state: Settings): OverlaySettings {
  return {
    tasks: state.tasks,
    token: state.token,
    verificatorSpace: state.verificatorSpace,
    detectionAction: state.detectionAction,
  };
}

/** Rejects with `Error('timeout')` if `promise` doesn't settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/** Runs `worker` over `items` with at most `limit` executing at any one time. */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      await worker(items[cursor++]);
    }
  });
  await Promise.all(runners);
}

async function verifyWithExternalApi(src: string): Promise<VerifyImageResponse> {
  const request: VerifyImageRequest = { type: VERIFY_IMAGE_MESSAGE, src };
  // The background runs the full activity lifecycle; it must not be retried (that would
  // create duplicate activities), so this is a plain one-shot message, not a react-query.
  return (await browser.runtime.sendMessage(request)) as VerifyImageResponse;
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const menuUi = await createShadowRootUi(ctx, {
      name: 'guard-menu',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(createElement(BadgeMenu));
        return root;
      },
      onRemove: (root) => root?.unmount()
    });
    menuUi.mount();

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      // Only trust a token handoff from the configured site. Validate the message's own origin (not
      // just the page's hostname): its protocol must match the configured website's (https in prod,
      // http for local dev) and its host must equal that site or a subdomain of it, so an
      // unrelated or cross-protocol same-window context can't inject a token.
      const allowedOrigin = new URL(import.meta.env.VITE_WEBSITE_URL);
      let originOk = false;
      try {
        const origin = new URL(event.origin);
        originOk =
          origin.protocol === allowedOrigin.protocol &&
          (origin.hostname === allowedOrigin.hostname ||
            origin.hostname.endsWith(`.${allowedOrigin.hostname}`));
      } catch {
        originOk = false;
      }
      if (!originOk) return;

      if (event.data?.type === 'EXT_AUTH_SUCCESS' && event.data.token) {
        void browser.runtime.sendMessage({
          type: 'TOKEN_RECEIVED',
          token: event.data.token
        });
      }
    });

    let stopWatching: (() => void) | undefined;

    function start(): void {
      if (stopWatching) return; // already running

      stopWatching = watchPageImages({
        filters: [byHttpSource(), bySupportedFormat(), byMinRenderedSize(MIN_IMAGE_SIZE_PX)],
        onNewCandidates: (candidates: ImageCandidate[]) => {
          void processCandidates(candidates);
        }
      });
    }

    function stop(): void {
      stopWatching?.();
      stopWatching = undefined;
      clearAllBadges();
      clearAllActions();
      clearOverlayState();
    }

    const isHostWhitelisted = (host: string, whitelist: string[]) => whitelist.includes(host);

    const shouldRun = (state: Settings) => {
      return state.isActive !== false && !isHostWhitelisted(location.hostname, state.exceptionSites);
    };

    let currentSettings = await settings.getValue();

    // The menu runs verification directly through the background; give the store the transport.
    setVerifyTransport(verifyWithExternalApi);
    updateSettings(toOverlaySettings(currentSettings));
    setAction(currentSettings.detectionAction);

    if (shouldRun(currentSettings)) {
      start();
    }

    settings.watch((newSettings) => {
      if (!newSettings) return;

      updateSettings(toOverlaySettings(newSettings));

      const wasRunning = shouldRun(currentSettings);
      const nowRunning = shouldRun(newSettings);

      if (wasRunning && !nowRunning) {
        stop();
      } else if (!wasRunning && nowRunning) {
        start();
      }

      if (currentSettings.detectionAction !== newSettings.detectionAction) {
        setAction(newSettings.detectionAction);
      }

      currentSettings = newSettings;
    });
  },
});