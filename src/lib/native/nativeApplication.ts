import { browser } from 'wxt/browser';

/**
 * Safari routes native messages to the containing app's handler and ignores this identifier, but
 * `sendNativeMessage` still demands one.
 *
 * Shared by every message the extension sends, so the two senders cannot drift apart.
 */
export const NATIVE_APPLICATION_ID = 'application.id';

/**
 * Opens the container app on its token store.
 *
 * A custom scheme rather than a link to the app: an extension page cannot launch an app any other
 * way, and the app registers this scheme in its `CFBundleURLTypes`. Navigating to it hands off to
 * the app without unloading the page that asked, the way `mailto:` does.
 */
export const APP_STORE_URL = 'elhio-guard://store';

/** Guard's settings in the container app (Safari only). */
export const APP_SETTINGS_URL = 'elhio://guard/settings';

/** Guard's setup in the container app (Safari only). */
export const APP_SETUP_URL = 'elhio://guard/setup';

/**
 * Sends a native message and gives up after `timeoutMs`.
 *
 * Safari leaves the promise pending for good when the native part goes away mid-message, which an app
 * update or reinstall does. The background merges reports and checks into the one on
 * its way, so a reply that never comes would block every later one until Safari unloads the
 * background. Giving up turns that into one failed round trip.
 */
export async function sendToApp(payload: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      browser.runtime.sendNativeMessage(NATIVE_APPLICATION_ID, payload),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('The app did not answer in time')), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
