import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import { fetchWithAuth } from '../client';
import { settings } from '@/lib/settings/store';
import {
  ACCESS_TOKEN,
  jsonResponse,
  refreshed,
  respondWith,
  seedSignedIn,
} from '@/test-utils/session';

// `browser.i18n` isn't part of the fake browser: messages come back as their keys
vi.mock('@/lib/i18n', () => ({ t: (key: string) => key, getAppLocale: () => 'en' }));

describe('request auth handling', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  // A 401 that survives a renewal is the one status that unambiguously means "this session is over":
  // the refresh token was refused too
  it('clears the stored session on a 401 the renewal cannot fix', async () => {
    vi.stubGlobal('fetch', respondWith(401, { detail: 'Could not validate credentials' }));

    await expect(fetchWithAuth('/api/v1/users/me')).rejects.toThrow();

    const after = await settings.getValue();
    expect(after.token).toBeNull();
    expect(after.refreshToken).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    expect(after.verificatorSpace).toBeNull();
  });

  // The access token can be refused before it runs out (a rotated signing key): renew once, retry
  it('renews the session once on a 401 and sends the request again', async () => {
    const next = refreshed();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Could not validate credentials' }))
      .mockResolvedValueOnce(jsonResponse(200, next))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'u1' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithAuth('/api/v1/users/me')).resolves.toEqual({ id: 'u1' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retried = fetchMock.mock.calls[2]![1] as RequestInit;
    expect((retried.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${next.access_token}`
    );
    expect((await settings.getValue()).refreshToken).toBe('rt_second');
  });

  it('renews an access token about to run out before sending the request', async () => {
    await seedSignedIn({}, 30_000);
    const next = refreshed();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, next))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'u1' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithAuth('/api/v1/users/me');

    expect(String(fetchMock.mock.calls[0]![0])).toContain('/api/v1/auth/refresh');
    const sent = fetchMock.mock.calls[1]![1] as RequestInit;
    expect((sent.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${next.access_token}`
    );
  });

  it('refuses without a session, without calling the API', async () => {
    await settings.setValue({ ...(await settings.getValue()), refreshToken: null });
    const fetchMock = respondWith(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithAuth('/api/v1/users/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A missing space returns 404 and a rate limit returns 429 — neither says anything about the
  // session, and signing the user out over one would be a bug.
  it.each([400, 403, 404, 429, 500])('keeps the session on %i', async (status) => {
    vi.stubGlobal('fetch', respondWith(status));

    await expect(fetchWithAuth('/api/v1/spaces/missing')).rejects.toThrow();

    expect((await settings.getValue()).token).toBe(ACCESS_TOKEN);
  });

  // Absorbed from the session-clearing tests: what gets cleared, and what must not be.
  it('leaves unrelated preferences alone when clearing', async () => {
    await seedSignedIn({
      targets: { aiGenerated: false, violent: true, explicit: false },
      exceptionSites: ['example.com'],
    });
    vi.stubGlobal('fetch', respondWith(401));

    await expect(fetchWithAuth('/api/v1/users/me')).rejects.toThrow();

    const after = await settings.getValue();
    expect(after.targets).toEqual({ aiGenerated: false, violent: true, explicit: false });
    expect(after.hasCompletedSetup).toBe(true);
    expect(after.exceptionSites).toEqual(['example.com']);
  });

  it('keeps the session on success', async () => {
    vi.stubGlobal('fetch', respondWith(200, { id: 'u1' }));

    await expect(fetchWithAuth('/api/v1/users/me')).resolves.toEqual({ id: 'u1' });

    expect((await settings.getValue()).token).toBe(ACCESS_TOKEN);
  });
});
