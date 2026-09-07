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
  APP_HANDOFF_MESSAGE,
  APP_HANDOFF_PARAM,
  type AppHandoffRequest
} from '@/lib/messaging/appHandoff';
import { isGetTabStatsRequest } from '@/lib/messaging/tabStatsMessages';

import {
  applyAction,
  clearAllBadges,
  ensureBadgeLayer,
  destroyBadgeLayer,
  clearAllActions,
  clearOverlayState,
  coverWhileProcessing,
  revealAfterProcessing,
  getPageStats,
  setAction,
  setVerifyTransport,
  updateSettings,
  markBadgesProcessing,
  showBadgeError,
  updateBadges,
  type OverlaySettings,
} from '@/lib/overlay';

import { settings, clearSession, type Settings } from '@/lib/settings';
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

/**
 * Styles for the `<guard-menu>` shadow host itself.
 *
 * WXT mounts the host into `<body>` and, with `position: 'inline'`, applies no styles of its own.
 * Its reset (`:host{all:initial !important}`) computes `display: inline`, which leaves an inline box
 * wrapping a UA-block `<html>`: that adds a line box to the page's body and becomes a stray item on
 * a flex or grid body. Because the reset is `!important`, styles set from JavaScript cannot win —
 * this has to go through the `css` option, which WXT appends after the reset in the same stylesheet.
 *
 * `position: fixed` is the load-bearing declaration: it takes the host out of flow entirely, so it
 * is never a flex or grid item and never generates a line box. The `transform`/`filter`/`contain`/
 * `will-change` resets are not cosmetic — any of them would make the host a containing block for the
 * `position: fixed` badge layer inside it, collapsing its `inset: 0` to a zero-sized box.
 */
const MENU_HOST_STYLES = `
  :host {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    display: block !important;
    overflow: visible !important;
    float: none !important;
    z-index: 2147483647 !important;
    transform: none !important;
    filter: none !important;
    contain: none !important;
    will-change: auto !important;
  }
  @media print { :host { display: none !important; } }
`;

async function processCandidates(candidates: ImageCandidate[]): Promise<void> {
  const currentSettings = await settings.getValue();
  // Keyed by URL because that is how a classification result comes back, but the value is every
  // element showing that URL, so all copies of a repeated image are badged from one classification.
  const elementsBySrc = new Map(candidates.map((candidate) => [candidate.src, candidate.elements]));

  markBadgesProcessing(candidates, elementsBySrc);

  // With a blur/hide action, cover images up front so unclassified content isn't shown before it's
  // known to be safe; each one is revealed (or kept covered if flagged) once its result arrives.
  for (const candidate of candidates) {
    for (const element of candidate.elements) coverWhileProcessing(element);
  }

  // Classify each image independently so every badge updates as soon as its own result
  // arrives, and one slow/failed image never blocks or fails the others.
  await runWithConcurrency(candidates, CLASSIFY_CONCURRENCY, (candidate) =>
    classifyCandidate(candidate, currentSettings, elementsBySrc)
  );
}

/**
 * MV2 targets (Firefox + Safari) deliver the classification result by pushing a
 * `CLASSIFY_RESULT_MESSAGE` from the background (`tabs.sendMessage`) rather than as a
 * `runtime.sendMessage` response, which they don't reliably return to a content-script sender.
 * These resolve the awaiting request by id.
 */
const pendingClassifications = new Map<string, (response: ClassifyImageResponse) => void>();
if (import.meta.env.MANIFEST_VERSION === 2) {
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
  if (import.meta.env.MANIFEST_VERSION === 2) {
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
  elementsBySrc: ReadonlyMap<string, readonly HTMLImageElement[]>
): Promise<void> {
  const elements = elementsBySrc.get(candidate.src) ?? [];
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
      for (const element of elements) showBadgeError(candidate.src, element, t('badge_error_analyze'));
      return;
    }

    // updateBadges handles a per-image error result (gray ring) itself; the menu decides
    // whether to offer Verify from the settings snapshot pushed to the store.
    updateBadges([result], elementsBySrc);
    applyAction([result], elementsBySrc);
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'timeout';
    const message = timedOut ? t('badge_error_timeout') : t('badge_error_analyze');
    for (const element of elements) showBadgeError(candidate.src, element, message);
  } finally {
    // Drop the pending entry (no-op on Chrome / already-resolved requests).
    pendingClassifications.delete(request.requestId);
    // Reveal the image unless it was flagged (applyAction ran above); no-op for the 'mark' action
    // and for images that were never covered. Runs on success, empty, and error/timeout paths.
    for (const element of elements) revealAfterProcessing(element);
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

/**
 * Decides whether a `postMessage` really came from the main website.
 *
 * Validates the message's own origin, not just the page's hostname, so an unrelated same-window
 * context can't pose as the site and hand us a token — or sign the user out. The port has to match
 * too: without it any `http://localhost:<any-port>` dev server would be trusted in development.
 */
function isWebsiteOrigin(origin: string): boolean {
  try {
    const allowed = new URL(import.meta.env.VITE_WEBSITE_URL);
    const actual = new URL(origin);
    return (
      actual.protocol === allowed.protocol &&
      actual.port === allowed.port &&
      (actual.hostname === allowed.hostname || actual.hostname.endsWith(`.${allowed.hostname}`))
    );
  } catch {
    return false;
  }
}

/**
 * Handles the website's auth signals: `EXT_AUTH_SUCCESS` after a login, which is relayed to
 * whichever extension page is waiting for the token, and `EXT_AUTH_LOGOUT` when the user signs out
 * or deletes their account, which is acted on here.
 *
 * This MUST be registered before `main` awaits anything. The script runs at `document_start` and
 * `postMessage` is not buffered, so a message posted while we're still waiting — and mounting the
 * menu waits for both its CSS and `<body>` — is dropped with no trace. That window is
 * invisible during a fresh login, where the user spends seconds typing credentials, but it reliably
 * swallows the handoff from an already-authenticated site, which posts the instant the page loads.
 */
function watchForAuthHandoff(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!isWebsiteOrigin(event.origin)) return;

    if (event.data?.type === 'EXT_AUTH_SUCCESS' && event.data.token) {
      void browser.runtime.sendMessage({
        type: 'TOKEN_RECEIVED',
        token: event.data.token
      });
      return;
    }

    if (event.data?.type === 'EXT_AUTH_LOGOUT') {
      void clearSession();
    }
  });
}

/**
 * Answers the popup's request for this page's scan counts.
 *
 * Only the top frame replies, so the numbers reflect the main page and stay deterministic when the
 * popup's `tabs.sendMessage` fans out to every frame. Returns a promise so the response is delivered
 * across all targets (Chrome MV3 and the MV2 browsers).
 */
function watchForTabStats(): void {
  if (window.top !== window) return;
  browser.runtime.onMessage.addListener((message) => {
    if (!isGetTabStatsRequest(message)) return;
    return Promise.resolve(getPageStats());
  });
}

/** How long the handoff page stays hidden before we give up and show it. */
const HANDOFF_MASK_TIMEOUT_MS = 4_000;

/**
 * Hides the handoff page so it never paints.
 *
 * This page is a throwaway — the user asked for Settings and should see Settings, not the marketing
 * site we only loaded to reach the extension. We run at `document_start`, before the first paint, so
 * hiding here means it never renders at all.
 *
 * Only when we run, though. After Safari has been quit, extensions aren't ready as the first page
 * loads and no content script runs, so the site renders and the background — which does start with
 * Safari — collects the command and opens the page in a tab of its own, leaving this one behind.
 * Both of those are accepted on a cold start; don't add tab-hunting to paper over them.
 *
 * `visibility` on the root element rather than a cover node: `<body>` doesn't exist yet at
 * `document_start` so there's nothing dependable to append to, an SPA that replaces `document.body`
 * would drop an injected node anyway, and this can't lose a z-index fight with the site's own fixed
 * chrome. The background colours match `pages.css` so the blank frame flows into the options page
 * instead of flashing white on the way into a dark UI.
 */
function maskHandoffPage(): void {
  const root = document.documentElement;
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.style.setProperty('visibility', 'hidden', 'important');
  root.style.setProperty('background', dark ? '#111111' : '#ffffff', 'important');

  const reveal = (): void => {
    root.style.removeProperty('visibility');
    root.style.removeProperty('background');
  };

  // A ceiling on failure, not a target
  setTimeout(reveal, HANDOFF_MASK_TIMEOUT_MS);

  // Restored from the back/forward cache the mask would otherwise still be applied, leaving the site
  // permanently blank.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reveal();
  });
}

/**
 * Wakes the background when the Apple container app hands off to us.
 *
 * The app parks its real instruction in the App Group and opens this page purely to reach the
 * extension. Telling the background right away is the whole point: it reports in, collects the
 * instruction, and navigates this tab to the page the user actually asked for. Left to itself a
 * non-persistent background page might not load again for minutes.
 *
 * Gated to our own site so a random page can't add the marker and get its tab taken over.
 *
 * Returns whether this *is* a handoff page, so the caller can skip the rest of the content script.
 */
function watchForAppHandoff(): boolean {
  try {
    const website = new URL(import.meta.env.VITE_WEBSITE_URL);
    if (location.hostname !== website.hostname) return false;
    if (!new URLSearchParams(location.search).has(APP_HANDOFF_PARAM)) return false;
  } catch {
    return false;
  }

  maskHandoffPage();

  void browser.runtime.sendMessage({ type: APP_HANDOFF_MESSAGE } satisfies AppHandoffRequest);

  // Drop the marker from the address bar. Navigating away leaves this URL in history, and coming
  // back to it would start a second handoff — one with no command waiting for it, which would just
  // sit behind the mask until it times out.
  try {
    const clean = new URL(location.href);
    clean.searchParams.delete(APP_HANDOFF_PARAM);
    history.replaceState(null, '', clean.toString());
  } catch {
    // Cosmetic only — a failure here doesn't affect the handoff itself.
  }

  return true;
}

/**
 * Resolves once `document.body` exists.
 *
 * WXT's `mountUi` throws outright when its anchor is missing rather than waiting for it, and this
 * script runs at `document_start`. `createShadowRootUi` awaits only the entrypoint CSS fetch, so on
 * a page with a slow `<head>` that await can settle before the parser has reached `<body>` — and the
 * throw then kills the rest of `main`: no menu, no badge layer, no image scanning at all. Reproduced
 * on tagesschau.de, where the extension silently did nothing.
 */
function bodyReady(): Promise<void> {
  if (document.body) return Promise.resolve();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.documentElement, { childList: true });
  });
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Before any `await` — see the note on the function.
    watchForAuthHandoff();
    watchForTabStats();

    // Nothing else is worth doing on a page we're about to leave: no shadow-root UI to mount, no
    // settings to read, no images to scan. Bailing keeps the handoff off the critical path.
    if (import.meta.env.SAFARI && watchForAppHandoff()) return;

    const menuUi = await createShadowRootUi(ctx, {
      name: 'guard-menu',
      position: 'inline',
      anchor: 'body',
      css: MENU_HOST_STYLES,
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(createElement(BadgeMenu));
        return root;
      },
      onRemove: (root) => root?.unmount()
    });
    await bodyReady();
    menuUi.mount();

    // Badge rings render in a viewport-fixed layer inside this same shadow root, so they never
    // touch the page's element tree. It is a sibling of WXT's inner <html>, keeping it clear of the
    // React root that owns `container`, and one z-index below the menu that shares the tree.
    ensureBadgeLayer(menuUi.shadow);
    ctx.onInvalidated(destroyBadgeLayer);

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
      return (
        state.hasCompletedSetup &&
        state.isActive !== false &&
        !isHostWhitelisted(location.hostname, state.exceptionSites)
      );
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