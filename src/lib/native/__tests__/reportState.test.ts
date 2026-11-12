import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';

import { reportStateToApp, appCommandUrl, containerAppVersion } from '../reportState';
import { settings } from '@/lib/settings/store';
import { appRevision } from '../appSync';

/**
 * `reportStateToApp` reports and returns; it must never open anything itself.
 *
 * That is the whole point of the split: the native handler drains a queued command destructively, so
 * exactly one caller may act on it, and only the background knows whether there's a handoff tab to
 * reuse. A regression here brings back the race where a startup report and a handoff report both
 * fired and the user got a stray tab.
 */
describe('reportStateToApp', () => {
  let sendNativeMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeBrowser.reset();

    sendNativeMessage = vi.fn().mockResolvedValue(undefined);
    // `sendNativeMessage` isn't part of the fake browser, so stand it up by hand.
    (browser.runtime as unknown as Record<string, unknown>).sendNativeMessage = sendNativeMessage;
    // `as never`: the callback overload in the browser typings makes the resolved type `void`.
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never);
    vi.spyOn(browser.tabs, 'create');
  });

  it('returns the command the app queued', async () => {
    sendNativeMessage.mockResolvedValue({ openSetup: true });
    await expect(reportStateToApp()).resolves.toBe('openSetup');

    sendNativeMessage.mockResolvedValue({ openOptions: true });
    await expect(reportStateToApp()).resolves.toBe('openOptions');
  });

  it('returns null when nothing is queued', async () => {
    sendNativeMessage.mockResolvedValue({});
    await expect(reportStateToApp()).resolves.toBeNull();

    sendNativeMessage.mockResolvedValue(undefined);
    await expect(reportStateToApp()).resolves.toBeNull();
  });

  it('returns null when the app is unreachable', async () => {
    // Best-effort bridge: the app may never have launched. Detection has to carry on regardless.
    sendNativeMessage.mockRejectedValue(new Error('no handler'));
    await expect(reportStateToApp()).resolves.toBeNull();
  });

  it('remembers the app version the handler reports', async () => {
    sendNativeMessage.mockResolvedValue({ appVersion: '0.1.0' });
    await reportStateToApp();

    await vi.waitFor(async () => expect(await containerAppVersion.getValue()).toBe('0.1.0'));
  });

  it('keeps the last known app version when a reply carries none', async () => {
    await containerAppVersion.setValue('0.1.0');
    sendNativeMessage.mockResolvedValue({ openSetup: true });

    await expect(reportStateToApp()).resolves.toBe('openSetup');
    expect(await containerAppVersion.getValue()).toBe('0.1.0');
  });

  it('opens no tabs, even when a command comes back', async () => {
    sendNativeMessage.mockResolvedValue({ openOptions: true });
    await reportStateToApp();
    expect(browser.tabs.create).not.toHaveBeenCalled();
  });

  it('reports the extension state the app needs', async () => {
    sendNativeMessage.mockResolvedValue({});
    await reportStateToApp();

    expect(sendNativeMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        hasCompletedSetup: false,
        hasSiteAccess: true,
        websiteUrl: import.meta.env.VITE_WEBSITE_URL,
        apiUrl: import.meta.env.VITE_API_URL
      })
    );
  });

  it('reports no site access when the permission check fails', async () => {
    vi.spyOn(browser.permissions, 'contains').mockRejectedValue(new Error('unsupported'));
    sendNativeMessage.mockResolvedValue({});
    await reportStateToApp();

    expect(sendNativeMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ hasSiteAccess: false })
    );
  });
});

describe('reportStateToApp, settings and session sync', () => {
  let sendNativeMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeBrowser.reset();
    sendNativeMessage = vi.fn().mockResolvedValue({});
    (browser.runtime as unknown as Record<string, unknown>).sendNativeMessage = sendNativeMessage;
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never);
  });

  it('names its type and sends the settings the app shows', async () => {
    await reportStateToApp();

    expect(sendNativeMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        type: 'state',
        settings: expect.objectContaining({ isActive: false, detectionAction: 'mark', exceptionSites: [] }),
        settingsChangedAt: null
      })
    );
  });

  it('takes the settings the app sends back', async () => {
    sendNativeMessage.mockResolvedValue({
      settings: {
        isActive: true,
        targets: { aiGenerated: true, violent: true, explicit: false },
        detectionAction: 'hide',
        useDetectorLocalModel: false,
        verificatorSpace: null,
        exceptionSites: []
      },
      settingsChangedAt: 1_800_000_000_000,
      completesSetup: true
    });

    await reportStateToApp();

    const current = await settings.getValue();
    expect(current.detectionAction).toBe('hide');
    expect(current.isActive).toBe(true);
    expect(current.hasCompletedSetup).toBe(true);
  });

  it('notes the app revision a reply reflects, so the next check compares against it', async () => {
    sendNativeMessage.mockResolvedValue({ revision: 43 });
    await reportStateToApp();
    expect(await appRevision.getValue()).toBe(43);
  });

  it('keeps the old revision when the app\'s settings could not be taken', async () => {
    await appRevision.setValue(42);
    vi.spyOn(settings, 'setValue').mockRejectedValue(new Error('storage full'));
    sendNativeMessage.mockResolvedValue({
      settings: {
        isActive: true,
        targets: { aiGenerated: true, violent: true, explicit: true },
        detectionAction: 'hide',
        useDetectorLocalModel: false,
        verificatorSpace: null,
        exceptionSites: []
      },
      settingsChangedAt: 1_800_000_000_000,
      revision: 43
    });

    await reportStateToApp();
    expect(await appRevision.getValue()).toBe(42);
  });
});

describe('appCommandUrl', () => {
  it('maps each command to its extension page', () => {
    expect(appCommandUrl('openSetup')).toContain('/setup.html');
    expect(appCommandUrl('openOptions')).toContain('/options.html');
  });
});
