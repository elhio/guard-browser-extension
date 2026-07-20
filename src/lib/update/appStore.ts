/**
 * App Store update check for the Safari build.
 *
 * Safari web extensions have no `runtime.requestUpdateCheck` (that's Chrome-only), and they're updated
 * through their App Store container app. The public iTunes Lookup API is the sanctioned way to learn
 * the latest *published* version and the store page URL; we compare it to the installed version and, if
 * newer, hand the user off to the App Store (we can't perform the update ourselves).
 */

/** The container app's bundle identifier — matches PRODUCT_BUNDLE_IDENTIFIER in the Xcode project. */
export const APPLE_BUNDLE_ID = 'com.elhio.guard';

export interface AppStoreInfo {
  /** The latest version published on the App Store. */
  version: string;
  /** The App Store page URL (`trackViewUrl`), or null if the response omitted it. */
  url: string | null;
}

/**
 * Looks up the app on the App Store by bundle id.
 *
 * Returns null when the app isn't found (e.g. not published yet) or the request fails — callers should
 * treat that as "couldn't check". The extension's `<all_urls>` host permission lets this cross-origin
 * fetch bypass CORS, so no manifest change is needed.
 */
export async function fetchAppStoreInfo(bundleId: string = APPLE_BUNDLE_ID): Promise<AppStoreInfo | null> {
  const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}`);
  if (!response.ok) return null;

  const data = (await response.json()) as { results?: Array<{ version?: unknown; trackViewUrl?: unknown }> };
  const app = data.results?.[0];
  if (!app || typeof app.version !== 'string') return null;

  return {
    version: app.version,
    url: typeof app.trackViewUrl === 'string' ? app.trackViewUrl : null,
  };
}

/**
 * Whether `candidate` is a strictly newer dotted version than `current` (e.g. "0.1.0" > "0.0.9").
 *
 * Compares segment by segment as integers; missing or non-numeric segments count as 0.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split('.');
  const b = current.split('.');
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
