import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import { fetchWithAuth } from '../client';
import { settings, defaultSettings } from '@/lib/settings/store';

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
  });
}

describe('request auth handling', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  // 401 is the API's answer for both an expired token and a deleted account, so it is the one
  // status that unambiguously means "this session is over".
  it('clears the stored session on 401', async () => {
    vi.stubGlobal('fetch', respondWith(401, { detail: 'Could not validate credentials' }));

    await expect(fetchWithAuth('/api/v1/users/me', 'a-token')).rejects.toThrow();

    const after = await settings.getValue();
    expect(after.token).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    expect(after.verificatorSpace).toBeNull();
  });

  // A missing space returns 404 and a rate limit returns 429 — neither says anything about the
  // session, and signing the user out over one would be a bug.
  it.each([400, 403, 404, 429, 500])('keeps the session on %i', async (status) => {
    vi.stubGlobal('fetch', respondWith(status));

    await expect(fetchWithAuth('/api/v1/spaces/missing', 'a-token')).rejects.toThrow();

    expect((await settings.getValue()).token).toBe('a-token');
  });

  // Absorbed from the session-clearing tests: what gets cleared, and what must not be.
  it('leaves unrelated preferences alone when clearing', async () => {
    await settings.setValue({
      ...defaultSettings,
      token: 'a-token',
      isLoggedIn: true,
      verificatorSpace: 'space-1',
      tasks: { aiGenerated: false, violent: true, explicit: false },
      hasCompletedSetup: true,
      exceptionSites: ['example.com'],
    });
    vi.stubGlobal('fetch', respondWith(401));

    await expect(fetchWithAuth('/api/v1/users/me', 'a-token')).rejects.toThrow();

    const after = await settings.getValue();
    expect(after.tasks).toEqual({ aiGenerated: false, violent: true, explicit: false });
    expect(after.hasCompletedSetup).toBe(true);
    expect(after.exceptionSites).toEqual(['example.com']);
  });

  it('keeps the session on success', async () => {
    vi.stubGlobal('fetch', respondWith(200, { id: 'u1' }));

    await expect(fetchWithAuth('/api/v1/users/me', 'a-token')).resolves.toEqual({ id: 'u1' });

    expect((await settings.getValue()).token).toBe('a-token');
  });
});
