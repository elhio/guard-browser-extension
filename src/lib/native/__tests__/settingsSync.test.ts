import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import {
  applyAppSettings,
  noteSettingsChange,
  parseSyncedSettings,
  settingsChangedAt,
  syncedSettings
} from '../settingsSync';
import { defaultSettings, settings } from '@/lib/settings/store';
import { seedSignedIn } from '@/test-utils/session';

/** A set of settings as the app sends it. */
function fromApp(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    targets: { aiGenerated: true, violent: false, explicit: true },
    detectionAction: 'blur',
    useDetectorLocalModel: true,
    verificatorSpace: 'space-2',
    exceptionSites: ['news.example.com'],
    ...overrides
  };
}

describe('noteSettingsChange', () => {
  beforeEach(() => fakeBrowser.reset());

  it('knows no time before the first report, so a change from the app wins', async () => {
    await expect(noteSettingsChange(syncedSettings(defaultSettings), 1000)).resolves.toBeNull();
  });

  it('keeps the time while the settings stay the same', async () => {
    const synced = syncedSettings(defaultSettings);
    await noteSettingsChange(synced, 1000);
    await expect(noteSettingsChange(synced, 2000)).resolves.toBeNull();
  });

  it('stamps a change made since the last report', async () => {
    await noteSettingsChange(syncedSettings(defaultSettings), 1000);
    const changed = syncedSettings({ ...defaultSettings, detectionAction: 'hide' });

    await expect(noteSettingsChange(changed, 5000)).resolves.toBe(5000);
    await expect(noteSettingsChange(changed, 9000)).resolves.toBe(5000);
  });
});

describe('applyAppSettings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('takes the app’s settings and keeps the session', async () => {
    await seedSignedIn();

    await expect(applyAppSettings({ settings: fromApp(), settingsChangedAt: 7000 })).resolves.toBe(true);

    const current = await settings.getValue();
    expect(current.detectionAction).toBe('blur');
    expect(current.targets).toEqual({ aiGenerated: true, violent: false, explicit: true });
    expect(current.verificatorSpace).toBe('space-2');
    expect(current.exceptionSites).toEqual(['news.example.com']);
    expect(current.refreshToken).toBe('rt_first');
  });

  it('stamps the app’s time, so the next report shows the settings unchanged', async () => {
    await applyAppSettings({ settings: fromApp(), settingsChangedAt: 7000 });

    expect(await settingsChangedAt.getValue()).toBe(7000);
    const after = syncedSettings(await settings.getValue());
    await expect(noteSettingsChange(after, 99_000)).resolves.toBe(7000);
  });

  it('finishes the setup when the app’s setup did', async () => {
    await applyAppSettings({ settings: fromApp(), settingsChangedAt: 7000, completesSetup: true });

    const current = await settings.getValue();
    expect(current.hasCompletedSetup).toBe(true);
    expect(current.hasPromptedSetup).toBe(true);
    expect(current.isActive).toBe(true);
  });

  it('refuses a malformed set or one without any target', async () => {
    await expect(
      applyAppSettings({ settings: fromApp({ detectionAction: 'explode' }), settingsChangedAt: 1 })
    ).resolves.toBe(false);
    await expect(applyAppSettings({ settings: fromApp(), settingsChangedAt: 'soon' })).resolves.toBe(false);
    await expect(applyAppSettings({})).resolves.toBe(false);
    expect(
      parseSyncedSettings(fromApp({ targets: { aiGenerated: false, violent: false, explicit: false } }))
    ).toBeNull();
    expect((await settings.getValue()).detectionAction).toBe('mark');
  });
});
