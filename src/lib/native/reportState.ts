import { browser } from 'wxt/browser';
import { settings } from '@/lib/settings';

/**
 * Safari-only bridge between the extension and the container app.
 *
 * The app cannot see any of the extension's state: iOS has no API to query whether an extension is
 * enabled (`SFSafariExtensionManager` is macOS-only), and `browser.storage` is unreachable from a
 * native target. Apple's sanctioned answer is native messaging plus an App Group — so the background
 * reports what it knows, and `SafariWebExtensionHandler` parks it in shared UserDefaults for the app.
 *
 * The same round trip carries commands the other way. The app can't open extension pages itself (iOS
 * refuses `safari-web-extension://` URLs from an app), so it queues a command that comes back as this
 * message's reply and gets executed here.
 *
 * Only the background script may talk to the native handler, and only with the `nativeMessaging`
 * permission — which is why both this module and that permission are gated to Safari.
 */

/** Safari routes native messages to the containing app's handler and ignores this identifier. */
const NATIVE_APPLICATION_ID = 'application.id';

interface NativeReply {
  /** The app's "Setup" button was pressed while it had no way to open the page itself. */
  openSetup?: boolean;
  /** The app's "Settings" button was pressed. */
  openOptions?: boolean;
}

/** A job the container app left for us, mirroring `GuardAppGroup.Command` on the native side. */
export type AppCommand = 'openSetup' | 'openOptions';

/**
 * The extension page that carries out a command.
 *
 * `/options.html` rather than `runtime.openOptionsPage()` so the caller controls *how* the page
 * opens — the handoff navigates the tab it was given instead of leaving a spare one behind. It's
 * also what the popup and the badge menu already link to, and Safari's `options_ui` has no
 * `open_in_tab`, so `openOptionsPage()` was opening a tab regardless, just less predictably.
 */
export function appCommandUrl(command: AppCommand): string {
  return browser.runtime.getURL(command === 'openSetup' ? '/setup.html' : '/options.html');
}

/**
 * Whether the user has actually granted access to websites.
 *
 * Worth asking explicitly rather than inferring from "the extension is running": on iOS the
 * background page runs as soon as the extension is enabled, even with no site access granted at all —
 * so the arrival of this very message only proves it's *enabled*. Without site access the content
 * scripts never run, and nothing gets detected.
 *
 * Ask about the content script's own match pattern rather than the manifest's `<all_urls>` host
 * permission: Safari records the user's grant under the content-script pattern (visible in its
 * Extensions.plist), so asking about `<all_urls>` answers "false" even when access is fully granted.
 * It is also the more truthful question — that pattern is what decides whether content scripts run.
 */
async function hasSiteAccess(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: ['*://*/*'] });
  } catch {
    return false;
  }
}

/**
 * Reports the extension's state to the container app and returns any command it left for us.
 *
 * Reporting only — carrying the command out is the caller's job. The handoff wants to reuse the tab
 * the app opened, while a report triggered by a settings or permission change has no tab to reuse,
 * and the native handler drains the command destructively, so exactly one caller may act on it.
 * Keeping the decision out here is what lets the background serialise those two paths.
 *
 * Safe to call often — it's a plain message round trip with no side effects beyond the reply.
 */
export async function reportStateToApp(): Promise<AppCommand | null> {
  try {
    // Both are IPC hops and neither depends on the other, so overlap them: this sits on the handoff's
    // critical path, between the user's tap and the page they asked for.
    const [{ hasCompletedSetup }, siteAccess] = await Promise.all([
      settings.getValue(),
      hasSiteAccess()
    ]);

    const reply = (await browser.runtime.sendNativeMessage(NATIVE_APPLICATION_ID, {
      hasCompletedSetup,
      hasSiteAccess: siteAccess,
      // The app has no way to know which site this build talks to — it's baked in here at build time
      // and differs between a dev server and production. It matters: the app opens this URL to hand
      // off to us, and the content script only honours the handoff marker on this exact host.
      websiteUrl: import.meta.env.VITE_WEBSITE_URL
    })) as NativeReply | undefined;

    if (reply?.openSetup) return 'openSetup';
    if (reply?.openOptions) return 'openOptions';
    return null;
  } catch (error) {
    // The bridge is best-effort: if the app never launched, or the handler isn't reachable, the
    // extension must carry on detecting regardless.
    console.warn('[Guard] Could not report state to the app:', error);
    return null;
  }
}
