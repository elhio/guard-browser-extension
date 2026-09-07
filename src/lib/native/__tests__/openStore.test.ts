import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { browser } from 'wxt/browser';

import { settings, defaultSettings } from '@/lib/settings';
import { handOverSessionToApp } from '../openStore';

/**
 * The handover is what makes a purchase possible: the container app runs the payment sheet, and it
 * cannot read the extension's storage to learn who is buying or which API to tell.
 *
 * The two rules worth pinning are that a signed-out user sends nothing at all, and that an
 * unreachable bridge answers false instead of throwing. The settings page launches the app either
 * way, so a rejection here must not take the click down with it.
 */
describe('handOverSessionToApp', () => {
  let sendNativeMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fakeBrowser.reset();

    // `sendNativeMessage` isn't part of the fake browser, so stand it up by hand.
    sendNativeMessage = vi.fn().mockResolvedValue({ handoverAccepted: true });
    (browser.runtime as unknown as Record<string, unknown>).sendNativeMessage = sendNativeMessage;

    await settings.setValue({ ...defaultSettings, token: 'a-token', isLoggedIn: true });
  });

  it('hands over the token and the API url', async () => {
    await expect(handOverSessionToApp()).resolves.toBe(true);

    expect(sendNativeMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        authToken: 'a-token',
        apiUrl: import.meta.env.VITE_API_URL
      })
    );
  });

  it('does not report the extension state', async () => {
    await handOverSessionToApp();

    const [, payload] = sendNativeMessage.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).not.toHaveProperty('hasCompletedSetup');
    expect(payload).not.toHaveProperty('hasSiteAccess');
  });

  it('sends nothing when there is no session to hand over', async () => {
    await settings.setValue({ ...defaultSettings, token: null, isLoggedIn: false });

    await expect(handOverSessionToApp()).resolves.toBe(false);
    expect(sendNativeMessage).not.toHaveBeenCalled();
  });

  it('reports failure when the app does not accept it', async () => {
    sendNativeMessage.mockResolvedValue({});
    await expect(handOverSessionToApp()).resolves.toBe(false);
  });

  it('resolves false rather than throwing when the bridge is unreachable', async () => {
    sendNativeMessage.mockRejectedValue(new Error('no handler'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(handOverSessionToApp()).resolves.toBe(false);
  });
});
