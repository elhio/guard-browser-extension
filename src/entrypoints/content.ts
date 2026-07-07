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

async function processCandidates(candidates: ImageCandidate[]): Promise<void> {
  const currentSettings = await settings.getValue();
  const elementsBySrc = new Map(candidates.map((candidate) => [candidate.src, candidate.element]));

  markBadgesProcessing(candidates, elementsBySrc);

  try {
    const response = await queryClient.fetchQuery({
      queryKey: [
        'classifyImages',
        candidates.map(c => c.src),
        currentSettings.tasks,
        currentSettings.useDetectorLocalModel
      ],
      queryFn: async () => {
        const request: ClassifyImageRequest = {
          type: CLASSIFY_IMAGE_MESSAGE,
          candidates: candidates.map(toSerializableCandidate),
          tasks: currentSettings.tasks,
          useDetectorLocalModel: currentSettings.useDetectorLocalModel
        };
        return browser.runtime.sendMessage(request) as Promise<ClassifyImageResponse>;
      }
    });

    if (!response || !response.results) {
      console.warn('[Guard] Classification skipped: Background script returned null or no results.');
      return;
    }

    updateBadges(response.results, elementsBySrc, verifyWithExternalApi);

    applyAction(response.results, elementsBySrc);

  } catch (error) {
    console.error('[Guard] Error processing image candidates:', error);

    for (const candidate of candidates) {
       const element = elementsBySrc.get(candidate.src);
       if (!element) continue;

       attachBadge(element).setError(t('badge_error_background'));
    }
  }
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