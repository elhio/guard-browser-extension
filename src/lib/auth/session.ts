import { ApiError } from '@/lib/api/errors';
import { t } from '@/lib/i18n';
import { clearSession, settings, type Settings } from '@/lib/settings/store';

/**
 * The extension's session with the API.
 *
 * The website hands the extension a session of its own: an access token that lives for minutes, and a
 * refresh token that renews it. Every renewal rotates the refresh token, so the one in storage is the
 * only one that works, and this module is the only place that reads or writes the pair.
 *
 * The background, the popup and the settings pages all make requests, each in its own context, so a
 * renewal runs once at a time across all of them where the browser has Web Locks (Chrome, Firefox,
 * Safari 15.4+). Correctness doesn't depend on it: the API answers a context that renews with the
 * just-rotated token within a few seconds with the same new pair, instead of taking it for a thief.
 */

/** The HTTP header that asks the API for the refresh token in the body rather than a cookie. */
const TOKEN_TRANSPORT_HEADER = { 'X-Token-Transport': 'body' };

/** Renew this long before the access token runs out, so no request goes out with a dying one. */
const REFRESH_MARGIN_MS = 60_000;

const LOCK_NAME = 'guard-session-refresh';

/** What the website hands over, and what a renewal answers. */
export interface SessionTokens {
  token: string;
  /** Seconds the access token lives */
  expiresIn: number;
  refreshToken: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string | null;
}

function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_URL || ''}${path}`;
}

function sessionOver(): ApiError {
  return new ApiError(t('auth_error_session_expired'), 401);
}

/** The signed-in fields of the settings for a pair of tokens, as of now. */
function sessionFields(tokens: SessionTokens): Pick<
  Settings,
  'token' | 'refreshToken' | 'tokenExpiresAt' | 'isLoggedIn'
> {
  return {
    token: tokens.token,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
    isLoggedIn: true,
  };
}

/**
 * Whether a handed-over message carries a whole session.
 *
 * @param value - Anything a message claims to be a session
 */
export function isSessionTokens(value: unknown): value is SessionTokens {
  const candidate = value as Record<string, unknown> | null;
  return (
    !!candidate &&
    typeof candidate.token === 'string' &&
    candidate.token.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0 &&
    typeof candidate.expiresIn === 'number' &&
    Number.isFinite(candidate.expiresIn) &&
    candidate.expiresIn > 0
  );
}

/**
 * Stores the session the website handed over, leaving every preference untouched.
 *
 * @param tokens - The access token, its lifetime and the refresh token
 */
export async function startSession(tokens: SessionTokens): Promise<void> {
  const current = await settings.getValue();
  await settings.setValue({ ...current, ...sessionFields(tokens) });
}

function isFresh(current: Settings): current is Settings & { token: string } {
  return (
    !!current.token &&
    current.tokenExpiresAt !== null &&
    current.tokenExpiresAt - Date.now() > REFRESH_MARGIN_MS
  );
}

/**
 * An access token good for at least another minute, renewed first if it isn't.
 *
 * @throws {ApiError} 401 when there is no session, or the API refused to renew it
 */
export async function getAccessToken(): Promise<string> {
  const current = await settings.getValue();
  if (!current.refreshToken) throw sessionOver();
  if (isFresh(current)) return current.token;
  return refreshSession(current.token);
}

let inflight: Promise<string> | undefined;

/**
 * Renews the access token, once at a time in this context and, with Web Locks, over all of them.
 *
 * @param stale - The access token the caller found wanting. When another context renewed while this
 *   one waited, its token is used instead of renewing again
 * @throws {ApiError} 401 when the API refused the refresh token: the session is over and has been
 *   cleared. Any other failure (offline, 429, 5xx) leaves the session for the next attempt
 */
export function refreshSession(stale: string | null = null): Promise<string> {
  if (inflight) return inflight;
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = () => renew(stale);
  // `request` resolves to what the callback's promise resolves to; the DOM typings nest it once more
  const renewal = locks?.request
    ? (locks.request(LOCK_NAME, run) as unknown as Promise<string>)
    : run();
  const shared = renewal.finally(() => {
    inflight = undefined;
  });
  inflight = shared;
  return shared;
}

async function renew(stale: string | null): Promise<string> {
  const current = await settings.getValue();
  if (!current.refreshToken) throw sessionOver();
  if (isFresh(current) && current.token !== stale) return current.token;

  const presented = current.refreshToken;
  const response = await fetch(apiUrl('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...TOKEN_TRANSPORT_HEADER },
    body: JSON.stringify({ refresh_token: presented }),
  });

  if (response.status === 401) {
    await clearSession();
    throw sessionOver();
  }
  if (!response.ok) {
    throw new ApiError(`API Error: ${response.status} ${response.statusText}`, response.status);
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.refresh_token) {
    // without it the rotated token is lost, and the next renewal would read as theft
    throw new ApiError('The API answered no refresh token', response.status);
  }

  // Signed out while the renewal was on its way: don't bring the session back.
  const latest = await settings.getValue();
  if (latest.refreshToken !== presented) {
    if (!latest.refreshToken) throw sessionOver();
    if (latest.token) return latest.token;
  }

  await settings.setValue({
    ...latest,
    ...sessionFields({
      token: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
    }),
  });
  return data.access_token;
}

/**
 * Signs out: forgets the session here at once, then ends it at the API.
 *
 * Ending it at the API is best effort. It takes the session off the user's list on the website, and
 * when it fails (offline), the forgotten refresh token runs out on its own.
 */
export async function endSession(): Promise<void> {
  const { refreshToken } = await settings.getValue();
  await clearSession();
  if (!refreshToken) return;

  try {
    await fetch(apiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TOKEN_TRANSPORT_HEADER },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (error) {
    console.warn('[Guard] Could not end the session at the API:', error);
  }
}

/**
 * The user the session belongs to: the `sub` claim of the access token.
 *
 * Read without verifying the signature, which is the API's job and needs a secret the extension
 * doesn't have. It only names the user in requests the API checks itself.
 *
 * @throws {ApiError} 401 when there is no session
 */
export async function getUserId(): Promise<string> {
  const token = await getAccessToken();
  const subject = readClaims(token)?.sub;
  if (typeof subject !== 'string' || !subject) {
    throw new ApiError('The access token names no user', 401);
  }
  return subject;
}

/**
 * Who is signed in, for keying cached responses: the user the access token names, or `null` when
 * nobody is. It stays the same over renewals, unlike the tokens, and changes with the account.
 *
 * @param current - The settings to read the session from
 */
export function sessionKey(current: Pick<Settings, 'token' | 'refreshToken'>): string | null {
  if (!current.refreshToken) return null;
  const subject = current.token ? readClaims(current.token)?.sub : undefined;
  return typeof subject === 'string' && subject ? subject : 'signed-in';
}

function readClaims(token: string): Record<string, unknown> | undefined {
  const segments = token.split('.');
  if (segments.length !== 3) return undefined;
  try {
    // JWTs use base64url, which swaps two characters of the alphabet and drops the padding `atob`
    // still expects
    const base64 = segments[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
