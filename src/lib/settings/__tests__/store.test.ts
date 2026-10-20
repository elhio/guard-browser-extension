import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import { defaultSettings, settings } from '../store';

describe('the 0.0.4 settings migration', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  // What 0.0.3 stored: `tasks` for the targets, and a long-lived token with no refresh token, which
  // the API now refuses
  const stored = {
    token: 'an-old-8-day-jwt',
    isLoggedIn: true,
    tasks: { aiGenerated: false, violent: true, explicit: false },
    detectionAction: 'blur',
    useDetectorLocalModel: true,
    verificatorSpace: 'space-1',
    hasCompletedSetup: true,
    hasPromptedSetup: true,
    isActive: true,
    exceptionSites: ['example.com'],
  };

  it('keeps the choices under their new name and ends the old session', async () => {
    await fakeBrowser.storage.local.set({ settings: stored });

    await settings.migrate();
    const after = await settings.getValue();

    expect(after.targets).toEqual(stored.tasks);
    expect('tasks' in after).toBe(false);
    expect(after.detectionAction).toBe('blur');
    expect(after.useDetectorLocalModel).toBe(true);
    expect(after.hasCompletedSetup).toBe(true);
    expect(after.isActive).toBe(true);
    expect(after.exceptionSites).toEqual(['example.com']);

    expect(after.token).toBeNull();
    expect(after.refreshToken).toBeNull();
    expect(after.tokenExpiresAt).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    expect(after.verificatorSpace).toBeNull();
  });

  it('falls back to the default targets when none were stored', async () => {
    const { tasks: _tasks, ...withoutTasks } = stored;
    await fakeBrowser.storage.local.set({ settings: withoutTasks });

    await settings.migrate();

    expect((await settings.getValue()).targets).toEqual(defaultSettings.targets);
  });
});
