import { byHttpSource, scanPageImages, toSerializableCandidate } from '../lib/images';
import {
  READ_C2PA_MANIFESTS_MESSAGE,
  type ReadC2paManifestsRequest,
  type ReadC2paManifestsResponse
} from '../lib/messaging/c2paMessages';

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    // Step 1: find the images on the page we care about.
    const candidates = scanPageImages({ filters: [byHttpSource()] });

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
  },
});
