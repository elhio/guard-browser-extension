import { browser } from 'wxt/browser';

import { ApiError } from '@/lib/api/errors';
import { revokeRefreshToken } from '@/lib/auth/session';
import { t } from '@/lib/i18n';
import {
  APP_TOKEN_MESSAGE,
  type AppTokenRequest,
  type AppTokenResponse
} from '@/lib/messaging/appToken';
import { clearSession, settings, type Settings } from '@/lib/settings/store';
import { NATIVE_APPLICATION_ID } from './nativeApplication';

/**
 * On Safari, Guard uses the container app's session instead of one of its own: one account, signed in
 * once, in the app.
 *
 * The app keeps and renews the refresh token, which never reaches the extension. Guard keeps only the
 * access token, with `refreshToken` set to {@link APP_SESSION} as the marker that it belongs to the app,
 * and asks the native part for a new one when it runs out or the API refuses it.
 *
 * Every state report's reply says whether the app is signed in ({@link followAppSession}): Guard takes
 * the app's session when there is one for the same API, ending a session of its own from the website,
 * and drops it when the app signed out. A session from the website stays in use while the app has none.
 */

/** Stands in for the refresh token while Guard uses the app's session. */
export const APP_SESSION = 'elhio-app-session';

/** Whether the session in `current` is the app's. */
export function usesAppSession(current: Pick<Settings, 'refreshToken'>): boolean {
  return current.refreshToken === APP_SESSION;
}

/** What the reply to a state report says about the app's session. */
export interface AppSessionState {
  signedIn?: boolean;
  /** The API the session belongs to. */
  apiUrl?: string;
}

/** The native part's answer to a token request. */
interface TokenReply {
  accessToken?: string;
  /** Seconds the token has left */
  expiresIn?: number;
  apiUrl?: string;
  signedOut?: boolean;
  unavailable?: boolean;
}

function normalized(url: string | undefined): string {
  return (url ?? '').replace(/\/+$/, '');
}

/** Whether a session of the app belongs to the API this build talks to. */
function isOurApi(apiUrl: string | undefined): boolean {
  return normalized(apiUrl) === normalized(import.meta.env.VITE_API_URL);
}

function sessionOver(): ApiError {
  return new ApiError(t('auth_error_session_expired'), 401);
}

/**
 * Takes the app's session when it has one for this API, or drops it when the app signed out.
 *
 * @param state - The `appSession` of the app's reply; a reply without it (an older app) changes nothing
 */
export async function followAppSession(state: AppSessionState | undefined): Promise<void> {
  if (!state || typeof state.signedIn !== 'boolean') return;
  const current = await settings.getValue();
  const appHasOne = state.signedIn && isOurApi(state.apiUrl);

  if (appHasOne && !usesAppSession(current)) {
    // A session of Guard's own, from the website: ended, so only one account is signed in.
    if (current.refreshToken) void revokeRefreshToken(current.refreshToken);
    await settings.setValue({
      ...(await settings.getValue()),
      token: null,
      tokenExpiresAt: null,
      refreshToken: APP_SESSION,
      isLoggedIn: true
    });
    // Fetched now rather than on first use, so the badge menu shows Guard signed in at once.
    await fetchAppToken(null).catch((error) => {
      console.warn('[Guard] Could not get a token from the app:', error);
    });
  } else if (!state.signedIn && usesAppSession(current)) {
    await clearSession();
  }
}

/** Set by the background, the one context that may talk to the native part. */
let isBackground = false;

/** Marks this context as the background. */
export function markBackgroundContext(): void {
  isBackground = true;
}

/**
 * A fresh access token of the app's session, stored in the settings.
 *
 * From any context: pages and the popup ask the background, which asks the native part.
 *
 * @param rejected - A token the API just refused, or that ran out; never handed back
 * @throws {ApiError} 401 when the app is signed out (Guard's copy is cleared), 503 when the app could
 *   not renew right now (offline): the session stays for the next attempt
 */
export async function fetchAppToken(rejected: string | null): Promise<string> {
  if (!isBackground) {
    const response = (await browser.runtime.sendMessage({
      type: APP_TOKEN_MESSAGE,
      rejected
    } satisfies AppTokenRequest)) as AppTokenResponse | undefined;
    if (response && 'token' in response) return response.token;
    if (response?.error === 'signedOut') throw sessionOver();
    throw new ApiError('The app could not renew the session', 503);
  }

  let reply: TokenReply | undefined;
  try {
    reply = (await browser.runtime.sendNativeMessage(NATIVE_APPLICATION_ID, {
      type: 'token',
      ...(rejected ? { rejected } : {})
    })) as TokenReply | undefined;
  } catch {
    throw new ApiError('The app could not be reached', 503);
  }

  if (reply?.accessToken && isOurApi(reply.apiUrl)) {
    const latest = await settings.getValue();
    // Signed out, or in on the website, while the request was on its way.
    if (!usesAppSession(latest)) throw sessionOver();
    await settings.setValue({
      ...latest,
      token: reply.accessToken,
      tokenExpiresAt: Date.now() + (reply.expiresIn ?? 600) * 1000,
      isLoggedIn: true
    });
    return reply.accessToken;
  }
  if (reply?.signedOut || reply?.accessToken) {
    // Signed out in the app, or signed in to another API than this build's.
    if (usesAppSession(await settings.getValue())) await clearSession();
    throw sessionOver();
  }
  throw new ApiError('The app could not renew the session', 503);
}

/**
 * Answers a page's {@link AppTokenRequest} in the background.
 *
 * @param request - The request
 */
export async function answerAppTokenRequest(request: AppTokenRequest): Promise<AppTokenResponse> {
  try {
    return { token: await fetchAppToken(request.rejected) };
  } catch (error) {
    return { error: error instanceof ApiError && error.status === 401 ? 'signedOut' : 'unavailable' };
  }
}
