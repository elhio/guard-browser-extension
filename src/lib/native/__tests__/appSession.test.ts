import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';

import {
  APP_SESSION,
  answerAppTokenRequest,
  fetchAppToken,
  followAppSession,
  markBackgroundContext
} from '../appSession';
import { getAccessToken, endSession } from '@/lib/auth/session';
import { defaultSettings, settings } from '@/lib/settings/store';
import { accessToken, respondWith, seedSignedIn } from '@/test-utils/session';

vi.mock('@/lib/i18n', () => ({ t: (key: string) => key, getAppLocale: () => 'en' }));

const API = import.meta.env.VITE_API_URL;
const APP_TOKEN = accessToken('u1', { app: true });

describe('the app’s session', () => {
  let sendNativeMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeBrowser.reset();
    markBackgroundContext();
    sendNativeMessage = vi.fn().mockResolvedValue({ accessToken: APP_TOKEN, expiresIn: 540, apiUrl: API });
    (browser.runtime as unknown as Record<string, unknown>).sendNativeMessage = sendNativeMessage;
    vi.stubGlobal('fetch', respondWith(204, null));
  });

  it('is taken when the app is signed in to the same API', async () => {
    await settings.setValue({ ...defaultSettings, hasCompletedSetup: true });

    await followAppSession({ signedIn: true, apiUrl: API });

    const current = await settings.getValue();
    expect(current.refreshToken).toBe(APP_SESSION);
    expect(current.token).toBe(APP_TOKEN);
    expect(current.isLoggedIn).toBe(true);
    expect(sendNativeMessage).toHaveBeenCalledWith(expect.any(String), { type: 'token' });
  });

  it('replaces Guard’s own session, ending it at the API', async () => {
    await seedSignedIn();
    const fetchMock = respondWith(204, null);
    vi.stubGlobal('fetch', fetchMock);

    await followAppSession({ signedIn: true, apiUrl: `${API}/` });

    expect((await settings.getValue()).refreshToken).toBe(APP_SESSION);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/api\/v1\/auth\/logout$/);
  });

  it('is left alone when the app talks to another API', async () => {
    await seedSignedIn();
    await followAppSession({ signedIn: true, apiUrl: 'https://elsewhere.example.com' });
    expect((await settings.getValue()).refreshToken).toBe('rt_first');
  });

  it('is dropped when the app signed out, but Guard’s own session is not', async () => {
    await seedSignedIn({ refreshToken: APP_SESSION });
    await followAppSession({ signedIn: false });
    expect((await settings.getValue()).refreshToken).toBeNull();

    await seedSignedIn();
    await followAppSession({ signedIn: false });
    expect((await settings.getValue()).refreshToken).toBe('rt_first');
  });

  it('changes nothing for an app that says nothing about it', async () => {
    await seedSignedIn();
    await followAppSession(undefined);
    expect((await settings.getValue()).refreshToken).toBe('rt_first');
  });

  it('is renewed by the app, not by the API', async () => {
    await seedSignedIn({ refreshToken: APP_SESSION }, 30_000);
    const fetchMock = respondWith(500);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken()).resolves.toBe(APP_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendNativeMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ type: 'token' }));
  });

  it('ends when the app says it is signed out', async () => {
    await seedSignedIn({ refreshToken: APP_SESSION }, 30_000);
    sendNativeMessage.mockResolvedValue({ signedOut: true });

    await expect(fetchAppToken('stale')).rejects.toMatchObject({ status: 401 });
    expect((await settings.getValue()).refreshToken).toBeNull();
  });

  it('stays when the app can’t renew right now', async () => {
    await seedSignedIn({ refreshToken: APP_SESSION }, 30_000);
    sendNativeMessage.mockResolvedValue({ unavailable: true });

    await expect(answerAppTokenRequest({ type: 'APP_TOKEN', rejected: null })).resolves.toEqual({
      error: 'unavailable'
    });
    expect((await settings.getValue()).refreshToken).toBe(APP_SESSION);
  });

  it('is not ended at the API when Guard signs out', async () => {
    await seedSignedIn({ refreshToken: APP_SESSION });
    const fetchMock = respondWith(204, null);
    vi.stubGlobal('fetch', fetchMock);

    await endSession();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await settings.getValue()).refreshToken).toBeNull();
  });
});
