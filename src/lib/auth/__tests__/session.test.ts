import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import {
  endSession,
  getAccessToken,
  getUserId,
  isSessionTokens,
  refreshSession,
  sessionKey,
  startSession,
} from '../session';
import { settings } from '@/lib/settings/store';
import {
  ACCESS_TOKEN,
  accessToken,
  jsonResponse,
  refreshed,
  respondWith,
  seedSignedIn,
} from '@/test-utils/session';

// `browser.i18n` isn't part of the fake browser: messages come back as their keys
vi.mock('@/lib/i18n', () => ({ t: (key: string) => key, getAppLocale: () => 'en' }));

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call = 0): unknown {
  return JSON.parse((fetchMock.mock.calls[call]![1] as RequestInit).body as string);
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  return (fetchMock.mock.calls[call]![1] as RequestInit).headers as Record<string, string>;
}

describe('getAccessToken', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
  });

  it('hands out a fresh access token without calling the API', async () => {
    await seedSignedIn();
    const fetchMock = respondWith(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken()).resolves.toBe(ACCESS_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The API sends the rotated token in a cookie unless asked for the body, and a cookie is of no use
  // here: it would be lost, and the next renewal with the old token would read as theft
  it('renews one about to run out with the refresh token, asking for the body', async () => {
    await seedSignedIn({}, 30_000);
    const next = refreshed();
    const fetchMock = respondWith(200, next);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken()).resolves.toBe(next.access_token);

    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/api\/v1\/auth\/refresh$/);
    expect(sentBody(fetchMock)).toEqual({ refresh_token: 'rt_first' });
    expect(sentHeaders(fetchMock)['X-Token-Transport']).toBe('body');

    const after = await settings.getValue();
    expect(after.token).toBe(next.access_token);
    expect(after.refreshToken).toBe('rt_second');
    expect(after.tokenExpiresAt).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    // the renewal must not disturb anything else
    expect(after.verificatorSpace).toBe('space-1');
    expect(after.hasCompletedSetup).toBe(true);
  });

  it('refuses without a session', async () => {
    const fetchMock = respondWith(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('refreshSession', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn({}, 30_000);
  });

  it('ends the session when the API refuses the refresh token', async () => {
    vi.stubGlobal('fetch', respondWith(401, { detail: 'Session expired, please log in again' }));

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });

    const after = await settings.getValue();
    expect(after.token).toBeNull();
    expect(after.refreshToken).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    expect(after.hasCompletedSetup).toBe(true);
  });

  // Offline, rate limited or down says nothing about the session: keep it for the next attempt
  it.each([429, 500, 503])('keeps the session on %i', async (status) => {
    vi.stubGlobal('fetch', respondWith(status));

    await expect(refreshSession()).rejects.toMatchObject({ status });

    expect((await settings.getValue()).refreshToken).toBe('rt_first');
  });

  it('keeps the session when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(refreshSession()).rejects.toThrow('Failed to fetch');

    expect((await settings.getValue()).refreshToken).toBe('rt_first');
  });

  it('keeps the old refresh token when an answer carries none', async () => {
    vi.stubGlobal('fetch', respondWith(200, { access_token: 'x', expires_in: 600 }));

    await expect(refreshSession()).rejects.toThrow();

    expect((await settings.getValue()).refreshToken).toBe('rt_first');
  });

  it('renews once for callers that ask at the same time', async () => {
    const fetchMock = respondWith(200, refreshed());
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await Promise.all([getAccessToken(), getAccessToken(), refreshSession()]);

    expect(new Set(tokens).size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Another context renewed while this one waited: its token is used rather than rotating again
  it('takes a token another context renewed in the meantime', async () => {
    const renewedElsewhere = accessToken('u1', { n: 9 });
    await seedSignedIn({ token: renewedElsewhere, refreshToken: 'rt_other' });
    const fetchMock = respondWith(200, refreshed());
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshSession(ACCESS_TOKEN)).resolves.toBe(renewedElsewhere);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not bring back a session that ended while it renewed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        await settings.setValue({
          ...(await settings.getValue()),
          token: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isLoggedIn: false,
        });
        return jsonResponse(200, refreshed());
      })
    );

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });

    expect((await settings.getValue()).refreshToken).toBeNull();
  });
});

describe('startSession and isSessionTokens', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('stores a handed-over session without touching preferences', async () => {
    await settings.setValue({
      ...(await settings.getValue()),
      hasCompletedSetup: true,
      exceptionSites: ['example.com'],
    });

    await startSession({ token: ACCESS_TOKEN, expiresIn: 600, refreshToken: 'rt_handed' });

    const after = await settings.getValue();
    expect(after.token).toBe(ACCESS_TOKEN);
    expect(after.refreshToken).toBe('rt_handed');
    expect(after.isLoggedIn).toBe(true);
    expect(after.tokenExpiresAt).toBeGreaterThan(Date.now());
    expect(after.hasCompletedSetup).toBe(true);
    expect(after.exceptionSites).toEqual(['example.com']);
  });

  it.each([
    ['a whole session', { token: 't', expiresIn: 600, refreshToken: 'rt_x' }, true],
    ['an access token alone', { token: 't' }, false],
    ['no lifetime', { token: 't', refreshToken: 'rt_x' }, false],
    ['an empty refresh token', { token: 't', expiresIn: 600, refreshToken: '' }, false],
    ['nothing', null, false],
  ])('accepts %s: %s', (_label, value, expected) => {
    expect(isSessionTokens(value)).toBe(expected);
  });
});

describe('endSession', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  it('forgets the session and ends it at the API', async () => {
    const fetchMock = respondWith(204);
    vi.stubGlobal('fetch', fetchMock);

    await endSession();

    expect((await settings.getValue()).refreshToken).toBeNull();
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(sentBody(fetchMock)).toEqual({ refresh_token: 'rt_first' });
    expect(sentHeaders(fetchMock)['X-Token-Transport']).toBe('body');
  });

  it('forgets the session even when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await endSession();

    const after = await settings.getValue();
    expect(after.refreshToken).toBeNull();
    expect(after.isLoggedIn).toBe(false);
  });
});

describe('getUserId and sessionKey', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('names the user from the access token, without a request', async () => {
    await seedSignedIn({ token: accessToken('user-42') });
    const fetchMock = respondWith(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(getUserId()).resolves.toBe('user-42');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keys the session by its user, unchanged by a renewal', () => {
    const first = sessionKey({ token: accessToken('u1', { n: 1 }), refreshToken: 'rt_a' });
    const renewed = sessionKey({ token: accessToken('u1', { n: 2 }), refreshToken: 'rt_b' });

    expect(first).toBe('u1');
    expect(renewed).toBe(first);
    expect(sessionKey({ token: accessToken('u2'), refreshToken: 'rt_c' })).toBe('u2');
    expect(sessionKey({ token: ACCESS_TOKEN, refreshToken: null })).toBeNull();
  });
});
