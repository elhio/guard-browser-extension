import { browser } from 'wxt/browser';
import { QueryClient } from '@tanstack/react-query';

import { byHttpSource, toSerializableCandidate, watchPageImages } from '@/lib/images';
import type { ImageCandidate } from '@/lib/images';
import {
  READ_C2PA_MANIFESTS_MESSAGE,
  type ReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '../lib/messaging/c2paMessages';
import {
  CLASSIFY_IMAGE_MESSAGE,
  type ClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/modelMessages';
import {
  EXTERNAL_API_VERIFY_MESSAGE,
  type ExternalApiVerifyRequest,
  type ExternalApiVerifyResponse
} from '@/lib/messaging/apiMessages';

import {
  applyAiBlur,
  clearAllBadges,
  clearAllBlurredImages,
  clearModelFallback,
  setBlurActive,
  setHoverUnblurActive,
  showAiBadges,
  showModelFallback,
//  showExternalScanButton
} from '@/lib/overlay';
import {
  getWhitelist,
  isAiCheckEnabled,
  isBlurEnabled,
  isGuardEnabled,
  isHostWhitelisted,
  isHoverUnblurEnabled,
  onAiCheckEnabledChange,
  onBlurEnabledChange,
  onGuardEnabledChange,
  onHoverUnblurEnabledChange,
  onWhitelistChange
} from '@/lib/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

let aiCheckActive = true;

async function processCandidates(candidates: ImageCandidate[]): Promise<void> {
  const response = await queryClient.fetchQuery({
    queryKey: ['c2paManifests', candidates.map(c => c.src)],
    queryFn: async () => {
      const request: ReadC2paManifestsRequest = {
        type: READ_C2PA_MANIFESTS_MESSAGE,
        candidates: candidates.map(toSerializableCandidate)
      };
      return browser.runtime.sendMessage(request) as Promise<ReadC2paManifestsResponse>;
    }
  });

  for (const result of response.results) {
    if (result.status === 'success' && result.aiDetection.isLikelyAiGenerated) {
      console.log('[Guard] Likely AI-generated:', result.candidate.src, result.aiDetection);
    }
  }

  const elementsBySrc = new Map(candidates.map((candidate) => [candidate.src, candidate.element]));
  showAiBadges(response.results, elementsBySrc);
  applyAiBlur(response.results, elementsBySrc);

  if (aiCheckActive) {
    showModelFallback(response.results, elementsBySrc, classifyImage);
    showExternalScanButton(response.results, elementsBySrc, verifyWithExternalApi);
  }
}

function classifyImage(src: string): Promise<ClassifyImageResponse> {
  return queryClient.fetchQuery({
    queryKey: ['classifyImage', src],
    queryFn: async () => {
      const request: ClassifyImageRequest = { type: CLASSIFY_IMAGE_MESSAGE, src };
      return browser.runtime.sendMessage(request) as Promise<ClassifyImageResponse>;
    }
  });
}

function verifyWithExternalApi(src: string): Promise<ExternalApiVerifyResponse> {
  return queryClient.fetchQuery({
    queryKey: ['verifyWithExternalApi', src],
    queryFn: async () => {
      const request: ExternalApiVerifyRequest = { type: EXTERNAL_API_VERIFY_MESSAGE, src };
      const res = await browser.runtime.sendMessage(request) as Promise<ExternalApiVerifyResponse>;

      if (!(await res).success) {
        throw new Error((await res).error);
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
      clearAllBlurredImages();
    }

    async function shouldRunHere(): Promise<boolean> {
      if (!(await isGuardEnabled())) return false;
      return !isHostWhitelisted(location.hostname, await getWhitelist());
    }

    if (await shouldRunHere()) {
      start();
    }

    setBlurActive(await isBlurEnabled());
    setHoverUnblurActive(await isHoverUnblurEnabled());
    aiCheckActive = await isAiCheckEnabled();

    onGuardEnabledChange((enabled: boolean) => {
      if (!enabled) {
        stop();
        return;
      }
      void getWhitelist().then((whitelist: string[]) => {
        if (!isHostWhitelisted(location.hostname, whitelist)) start();
      });
    });

    onBlurEnabledChange(setBlurActive);
    onHoverUnblurEnabledChange(setHoverUnblurActive);

    onAiCheckEnabledChange((enabled: boolean) => {
      aiCheckActive = enabled;
      if (!enabled) clearModelFallback();
    });

    onWhitelistChange((whitelist: string[]) => {
      if (isHostWhitelisted(location.hostname, whitelist)) {
        stop();
        return;
      }
      void isGuardEnabled().then((enabled: boolean) => {
        if (enabled) start();
      });
    });
  },
});
