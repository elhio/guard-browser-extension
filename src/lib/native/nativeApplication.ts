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
