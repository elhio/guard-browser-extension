/**
 * Delivers an asynchronous `onMessage` response in a way that works on both Chrome and Firefox,
 * which use `wxt/browser`'s NATIVE extension APIs (not the webextension-polyfill).
 *
 * The two engines disagree on how a listener signals an async reply:
 * - Chrome (native `chrome.runtime`): the listener must call `sendResponse` later and return
 *   `true` synchronously. A returned Promise is ignored.
 * - Firefox (native `browser.runtime`): the listener must RETURN A PROMISE. Its `sendResponse` +
 *   `return true` path is unreliable here — the message channel resolves with `undefined` before
 *   the late `sendResponse` fires (observed: background's `sendMessage` resolved empty ~2s before
 *   the offscreen document replied).
 *
 * Return the result of this call from the listener. The `import.meta.env.FIREFOX` branch is a
 * build-time constant, so each browser build keeps only its own path.
 *
 * @param work - The promise resolving to the response payload. It must not reject; resolve it with
 *   an error-shaped payload instead, so a response is always delivered.
 * @param sendResponse - The listener's `sendResponse` callback (used on Chrome).
 * @returns `true` on Chrome (keep the channel open) or the promise on Firefox.
 */
export function respondAsync<T>(
  work: Promise<T>,
  sendResponse: (response: T) => void
): true | Promise<T> {
  if (import.meta.env.FIREFOX) {
    return work;
  }
  void work.then(sendResponse);
  return true;
}
