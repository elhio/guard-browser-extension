import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import { ApiError } from '../client';
import { fetchUserProfile, getUserId, isSessionRejected } from '../accounts';
import { settings, defaultSettings } from '@/lib/settings/store';

const PROFILE = {
  id: 'u1',
  name: 'ada',
  full_name: 'Ada Lovelace',
  active_plan_name: 'Individual',
  is_restricted: false,
};

function respondWith(status: number, body: unknown = { detail: 'nope' }) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

async function seedSignedIn() {
  await settings.setValue({
    ...defaultSettings,
    token: 'a-token',
    isLoggedIn: true,
    verificatorSpace: 'space-1',
    hasCompletedSetup: true,
  });
}

describe('fetchUserProfile', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  // The two ways a token can verify perfectly and still name nobody. Neither produces the 401 that
  // would otherwise have ended the session, so without this the dead token sits in storage forever
  it.each([
    [400, 'Inactive user'],
    [404, 'User not found'],
  ])('ends the session on %i', async (status, detail) => {
    vi.stubGlobal('fetch', respondWith(status, { detail }));

    await expect(fetchUserProfile('a-token')).rejects.toThrow();

    const after = await settings.getValue();
    expect(after.token).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    expect(after.verificatorSpace).toBeNull();
    // Local preferences are not part of the session
    expect(after.hasCompletedSetup).toBe(true);
  });

  // 403 is only ever a service account token here, 429 is a rate limit, and 500 is the server's
  // problem. Signing the user out over any of them would be a bug
  it.each([403, 429, 500])('keeps the session on %i', async (status) => {
    vi.stubGlobal('fetch', respondWith(status));

    await expect(fetchUserProfile('a-token')).rejects.toThrow();

    expect((await settings.getValue()).token).toBe('a-token');
  });

  it('keeps the session on success', async () => {
    vi.stubGlobal('fetch', respondWith(200, PROFILE));

    await expect(fetchUserProfile('a-token')).resolves.toEqual(PROFILE);

    expect((await settings.getValue()).token).toBe('a-token');
  });
});

describe('isSessionRejected', () => {
  it.each([401, 400, 404])('is true for %i', (status) => {
    expect(isSessionRejected(new ApiError('nope', status))).toBe(true);
  });

  it.each([403, 429, 500, 503])('is false for %i', (status) => {
    expect(isSessionRejected(new ApiError('nope', status))).toBe(false);
  });

  // A dropped connection throws a plain TypeError from fetch, which never reaches a status at all
  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a plain error', new Error('boom')],
    ['nothing', undefined],
  ])('is false for %s', (_label, error) => {
    expect(isSessionRejected(error)).toBe(false);
  });
});

describe('getUserId', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  it('memoizes the id per token', async () => {
    const fetchMock = respondWith(200, PROFILE);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getUserId('a-token')).resolves.toBe('u1');
    await expect(getUserId('a-token')).resolves.toBe('u1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The memo must not outlive the account it describes. A rejected profile fetch drops it, so the
  // next lookup asks the API again instead of handing back an id for a user it has disowned
  it('drops the memo when the identity is rejected', async () => {
    vi.stubGlobal('fetch', respondWith(200, PROFILE));
    await expect(getUserId('a-token')).resolves.toBe('u1');

    vi.stubGlobal('fetch', respondWith(400, { detail: 'Inactive user' }));
    await expect(fetchUserProfile('a-token')).rejects.toThrow();

    const refetch = respondWith(200, PROFILE);
    vi.stubGlobal('fetch', refetch);
    await expect(getUserId('a-token')).resolves.toBe('u1');

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
