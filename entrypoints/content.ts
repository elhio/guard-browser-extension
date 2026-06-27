import { byHttpSource, toSerializableCandidate, watchPageImages } from '@/lib/images';
import type { ImageCandidate } from '@/lib/images';
import {
  READ_C2PA_MANIFESTS_MESSAGE,
  type ReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '../lib/messaging/c2paMessages';
import {
  applyAiBlur,
  clearAllBadges,
  clearAllBlurredImages,
  setBlurActive,
  setHoverUnblurActive,
  showAiBadges
} from '@/lib/overlay';
import {
  getWhitelist,
  isBlurEnabled,
  isGuardEnabled,
  isHostWhitelisted,
  isHoverUnblurEnabled,
  onBlurEnabledChange,
  onGuardEnabledChange,
  onHoverUnblurEnabledChange,
  onWhitelistChange
} from '@/lib/settings';

/** Steps 2-4 of the pipeline for one batch of newly discovered image candidates. */
async function processCandidates(candidates: ImageCandidate[]): Promise<void> {
  // Step 2: ask the background script to read C2PA metadata for them.
  // (WASM compilation must happen there, under the extension's own CSP,
  // not the host page's — running it here fails on sites with strict CSPs.)
  const request: ReadC2paManifestsRequest = {
    type: READ_C2PA_MANIFESTS_MESSAGE,
    candidates: candidates.map(toSerializableCandidate)
  };
  const response: ReadC2paManifestsResponse = await browser.runtime.sendMessage(request);

  console.log('[Guard] scanned images:', candidates);
  console.log('[Guard] C2PA read results:', response.results);

  // Step 3: flag any image whose manifest hints at AI generation.
  for (const result of response.results) {
    if (result.status === 'success' && result.aiDetection.isLikelyAiGenerated) {
      console.log('[Guard] likely AI-generated:', result.candidate.src, result.aiDetection);
    }
  }

  // Step 4: overlay a badge on every image flagged as likely AI-generated.
  // The DOM <img> element doesn't survive the round trip through the
  // background script, so look it up again here by src.
  const elementsBySrc = new Map(candidates.map((candidate) => [candidate.src, candidate.element]));
  showAiBadges(response.results, elementsBySrc);
  applyAiBlur(response.results, elementsBySrc);
}

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    let stopWatching: (() => void) | undefined;

    function start(): void {
      if (stopWatching) return; // already running

      // Step 1: find the images on the page we care about, and keep finding
      // more — many pages (image search results, infinite scroll, ...) render
      // most of their images well after this script first runs.
      stopWatching = watchPageImages({
        filters: [byHttpSource()],
        onNewCandidates: (candidates) => {
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

    // React live to the popup's on/off toggles, without needing a page reload.
    onGuardEnabledChange((enabled) => {
      if (!enabled) {
        stop();
        return;
      }
      void getWhitelist().then((whitelist) => {
        if (!isHostWhitelisted(location.hostname, whitelist)) start();
      });
    });
    onBlurEnabledChange(setBlurActive);
    onHoverUnblurEnabledChange(setHoverUnblurActive);

    // React live to whitelist edits in the popup, without needing a page reload.
    onWhitelistChange((whitelist) => {
      if (isHostWhitelisted(location.hostname, whitelist)) {
        stop();
        return;
      }
      void isGuardEnabled().then((enabled) => {
        if (enabled) start();
      });
    });
  },
});
