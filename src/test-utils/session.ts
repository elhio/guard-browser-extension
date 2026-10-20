import { vi } from 'vitest';

import { defaultSettings, settings, type Settings } from '@/lib/settings/store';

/** An access token as the API issues one: a JWT naming `sub`. Unsigned, which the extension never checks. */
export function accessToken(sub = 'u1', extra: Record<string, unknown> = {}): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub, ...extra }), 'signature'].join('.');
}

/** The access token every signed-in seed starts with. */
export const ACCESS_TOKEN = accessToken();

/** Stores a signed-in session whose access token has `expiresInMs` left (10 minutes by default). */
export async function seedSignedIn(
  overrides: Partial<Settings> = {},
  expiresInMs = 10 * 60 * 1000
): Promise<void> {
  await settings.setValue({
    ...defaultSettings,
    token: ACCESS_TOKEN,
    refreshToken: 'rt_first',
    tokenExpiresAt: Date.now() + expiresInMs,
    isLoggedIn: true,
    verificatorSpace: 'space-1',
    hasCompletedSetup: true,
    ...overrides,
  });
}

/** A `fetch` mock answering every call with one status and body. */
export function respondWith(status: number, body: unknown = { detail: 'nope' }) {
  return vi.fn().mockImplementation(async () => jsonResponse(status, body));
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** What a refresh answers: the rotated pair, in the body. */
export function refreshed(token = accessToken('u1', { n: 2 }), refreshToken = 'rt_second') {
  return { access_token: token, expires_in: 600, refresh_token: refreshToken };
}
