import { browser } from 'wxt/browser';
import { QueryClient } from '@tanstack/react-query';

import { byHttpSource, toSerializableCandidate, watchPageImages } from '@/lib/images';
import type { ImageCandidate } from '@/lib/images';
import {
  CLASSIFY_IMAGE_MESSAGE,
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
  attachBadge,
  clearAllBadges,
  clearAllActions,
  setAction,
  markBadgesProcessing,
  updateBadges,
} from '@/lib/overlay';

import { settings, type Settings } from '@/lib/settings';
import { t } from '@/lib/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
    },
  },
});

/** Max images classified in parallel (bounds concurrent fetch/metadata/C2PA work). */
const CLASSIFY_CONCURRENCY = 4;
/** Give up on a single image's classification after this long and mark it failed. */
const CLASSIFY_TIMEOUT_MS = 20_000;

async function processCandidates(candidates: ImageCandidate[]): Promise<void> {
  const currentSettings = await settings.getValue();
  const elementsBySrc = new Map(candidates.map((candidate) => [candidate.src, candidate.element]));

  markBadgesProcessing(candidates, elementsBySrc);

  // Classify each image independently so every badge updates as soon as its own result
  // arrives, and one slow/failed image never blocks or fails the others.
  await runWithConcurrency(candidates, CLASSIFY_CONCURRENCY, (candidate) =>
    classifyCandidate(candidate, currentSettings, elementsBySrc)
  );
}

async function classifyCandidate(
  candidate: ImageCandidate,
  currentSettings: Settings,
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): Promise<void> {
  const element = elementsBySrc.get(candidate.src);

  try {
    const request: ClassifyImageRequest = {
      type: CLASSIFY_IMAGE_MESSAGE,
      candidates: [toSerializableCandidate(candidate)],
      tasks: currentSettings.tasks,
      useDetectorLocalModel: currentSettings.useDetectorLocalModel
    };

    const response = await withTimeout(
      browser.runtime.sendMessage(request) as Promise<ClassifyImageResponse>,
      CLASSIFY_TIMEOUT_MS
    );

    const result = response?.results?.[0];
    if (!result) {
      if (element) attachBadge(element).setError(t('badge_error_analyze'));
      return;
    }

    // updateBadges/applyAction handle a per-image error result (gray badge) on their own.
    updateBadges([result], elementsBySrc, verifyWithExternalApi);
    applyAction([result], elementsBySrc);
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'timeout';
    if (element) attachBadge(element).setError(timedOut ? t('badge_error_timeout') : t('badge_error_analyze'));
  }
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

function verifyWithExternalApi(src: string): Promise<VerifyImageResponse> {
  return queryClient.fetchQuery({
    queryKey: ['verifyImages', src],
    queryFn: async () => {
      const request: VerifyImageRequest = { type: VERIFY_IMAGE_MESSAGE, src };
      const res = (await browser.runtime.sendMessage(request)) as VerifyImageResponse;

      if (!res.success) {
        throw new Error(res.error);
      }
      return res;
    }
  });
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_start',
  async main() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      // security check
      const envUrl = import.meta.env.VITE_WEBSITE_URL;
      const allowedHost = new URL(envUrl).hostname;
      const isAllowedHost = location.hostname === allowedHost || location.hostname.endsWith(`.${allowedHost}`);
      if (!isAllowedHost) return;

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
        filters: [byHttpSource()],
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
    }

    const isHostWhitelisted = (host: string, whitelist: string[]) => whitelist.includes(host);

    const shouldRun = (state: Settings) => {
      return state.isActive !== false && !isHostWhitelisted(location.hostname, state.exceptionSites);
    };

    let currentSettings = await settings.getValue();

    setAction(currentSettings.detectionAction);

    if (shouldRun(currentSettings)) {
      start();
    }

    settings.watch((newSettings) => {
      if (!newSettings) return;

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