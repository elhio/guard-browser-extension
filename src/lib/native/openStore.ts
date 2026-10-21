import { browser } from 'wxt/browser';
import { refreshSession } from '@/lib/auth/session';
import { settings } from '@/lib/settings';
import { NATIVE_APPLICATION_ID } from './nativeApplication';

/**
 * Safari-only session handover to the container app for StoreKit purchases.
 *
 * StoreKit cannot present payment sheets from `SafariWebExtensionHandler` (extensions lack a window).
 * This passes an access token and the API base URL to the native app, which completes the purchase.
 * The token is parked temporarily for single-read collection, kept in memory, and expires automatically.
 * It is renewed right before, so the app gets its whole lifetime. The refresh token stays here: two
 * holders rotating it would take each other for a thief.
 */

/**
 * Passes the session to the container app for collection.
 *
 * @returns `true` if accepted by the native handler; `false` if signed out or unreachable
 * (the caller should still launch the app to handle the fallback UI).
 */
export async function handOverSessionToApp(): Promise<boolean> {
  try {
    const { token: current, refreshToken } = await settings.getValue();
    if (!refreshToken) return false;
    const token = await refreshSession(current);

    const reply = (await browser.runtime.sendNativeMessage(NATIVE_APPLICATION_ID, {
      authToken: token,
      apiUrl: import.meta.env.VITE_API_URL
    })) as { handoverAccepted?: boolean } | undefined;

    return reply?.handoverAccepted === true;
  } catch (error) {
    // Best-effort, exactly like the state report: a missing handler must not take the settings page
    // down with it.
    console.warn('[Guard] Could not hand the session to the app:', error);
    return false;
  }
}
