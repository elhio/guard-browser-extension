import { browser } from 'wxt/browser';
import { settings } from '@/lib/settings';
import { sendToApp } from './nativeApplication';
import { applyAppSettings, noteSettingsChange, syncedSettings, type AppSettingsReply } from './settingsSync';
import { followAppSession, type AppSessionState } from './appSession';
import { noteAppRevision } from './appSync';

/**
 * Safari-only bridge between the extension and the container app.
 *
 * The app cannot see the extension's state: `browser.storage` is unreachable from a native target, and
 * iOS tells the app little more than whether the extension is enabled. Apple's sanctioned answer is native
 * messaging plus an App Group — so the background reports what it knows, and `SafariWebExtensionHandler`
 * parks it in shared UserDefaults for the app.
 *
 * The same round trip carries things the other way, since the app can't reach the extension by itself:
 * Guard's settings when they were changed in the app (`settingsSync.ts`), whether the app is signed in
 * (`appSession.ts`), and, from older app builds, a command to open a page (iOS refuses
 * `safari-web-extension://` URLs from an app).
 *
 * Only the background script may talk to the native handler, and only with the `nativeMessaging`
 * permission — which is why both this module and that permission are gated to Safari.
 */

interface NativeReply extends AppSettingsReply {
  /** Whether the app is signed in, and to which API. */
  appSession?: AppSessionState;
  /** The app's "Setup" button was pressed while it had no way to open the page itself. */
  openSetup?: boolean;
  /** The app's "Settings" button was pressed. */
  openOptions?: boolean;
  /** The container app's own version (`CFBundleShortVersionString`), sent with every reply. */
  appVersion?: string;
  /** The app's revision this reply reflects; the next cheap check compares against it (`appSync.ts`). */
  revision?: number;
}

/**
 * The version of the container app this extension ships in, as its native handler last reported it.
 *
 * The App Store versions the app, not the extension, and the app is released from its own repository
 * on its own schedule — so the Safari update check compares the store's version against this rather
 * than against the manifest. `null` until the handler has answered once, or with an app build that
 * predates the field; the update check then falls back to the manifest version.
 */
export const containerAppVersion = storage.defineItem<string | null>('local:containerAppVersion', {
  fallback: null
});

/** A report is answered from local state; far slower means the native part is gone. */
const REPORT_TIMEOUT_MS = 10_000;

/** A job the container app left for us, mirroring `GuardCommand` in the app's ElhioBridge module. */
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
    const [current, siteAccess] = await Promise.all([settings.getValue(), hasSiteAccess()]);
    const synced = syncedSettings(current);
    const settingsChangedAt = await noteSettingsChange(synced);

    const reply = (await sendToApp({
      type: 'state',
      hasCompletedSetup: current.hasCompletedSetup,
      hasSiteAccess: siteAccess,
      // The app has no way to know which site this build talks to — it's baked in here at build time
      // and differs between a dev server and production. It matters: the app opens this URL to hand
      // off to us, and the content script only honours the handoff marker on this exact host.
      websiteUrl: import.meta.env.VITE_WEBSITE_URL,
      apiUrl: import.meta.env.VITE_API_URL,
      settings: synced,
      settingsChangedAt
    }, REPORT_TIMEOUT_MS)) as NativeReply | undefined;

    // Each write here triggers another report, which then shows the app the settings taken; the app
    // stops sending them, so the round trips end.
    let tookAll = true;
    await applyAppSettings(reply).catch((error) => {
      tookAll = false;
      console.warn('[Guard] Could not take the settings from the app:', error);
    });
    await followAppSession(reply?.appSession).catch((error) => {
      tookAll = false;
      console.warn('[Guard] Could not follow the app\'s session:', error);
    });
    // Only once the reply is taken: after a failed write the old revision stays, so the next check asks
    // again.
    if (tookAll) {
      await noteAppRevision(reply).catch((error) => {
        console.warn('[Guard] Could not note the app\'s revision:', error);
      });
    }

    // Not awaited: this sits on the handoff's critical path, and nothing here depends on it landing.
    if (typeof reply?.appVersion === 'string') {
      containerAppVersion.setValue(reply.appVersion).catch((error) => {
        console.warn('[Guard] Could not store the app version:', error);
      });
    }

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
