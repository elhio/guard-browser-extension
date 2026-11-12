import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';

import { appRevision, checkAppForChanges, noteAppRevision } from '../appSync';

describe('checkAppForChanges', () => {
  let sendNativeMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeBrowser.reset();
    sendNativeMessage = vi.fn().mockResolvedValue(undefined);
    (browser.runtime as unknown as Record<string, unknown>).sendNativeMessage = sendNativeMessage;
  });

  it('sends the revision of the last report', async () => {
    await appRevision.setValue(42);
    await checkAppForChanges();
    expect(sendNativeMessage).toHaveBeenCalledWith('application.id', { type: 'sync', revision: 42 });
  });

  it('sends null before the first report', async () => {
    await checkAppForChanges();
    expect(sendNativeMessage).toHaveBeenCalledWith('application.id', { type: 'sync', revision: null });
  });

  it('answers what the app says', async () => {
    sendNativeMessage.mockResolvedValue({ changed: true });
    await expect(checkAppForChanges()).resolves.toBe(true);

    sendNativeMessage.mockResolvedValue({ changed: false });
    await expect(checkAppForChanges()).resolves.toBe(false);
  });

  it('counts an app without the check, or none at all, as no change', async () => {
    // An app that doesn't know the check answers an unknown message with an empty reply.
    sendNativeMessage.mockResolvedValue({});
    await expect(checkAppForChanges()).resolves.toBe(false);

    sendNativeMessage.mockRejectedValue(new Error('no handler'));
    await expect(checkAppForChanges()).resolves.toBe(false);
  });
});

describe('noteAppRevision', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps the revision a reply carries', async () => {
    await noteAppRevision({ revision: 7 });
    expect(await appRevision.getValue()).toBe(7);
  });

  it('leaves it alone when a reply carries none or nonsense', async () => {
    await appRevision.setValue(7);
    await noteAppRevision(undefined);
    await noteAppRevision({});
    await noteAppRevision({ revision: '8' });
    expect(await appRevision.getValue()).toBe(7);
  });
});

describe('a native part that never answers', () => {
  beforeEach(() => fakeBrowser.reset());

  it('counts as no change after a few seconds, so later checks are not blocked', async () => {
    vi.useFakeTimers();
    try {
      (browser.runtime as unknown as Record<string, unknown>).sendNativeMessage = vi.fn(() => new Promise(() => {}));
      const answer = checkAppForChanges();
      await vi.advanceTimersByTimeAsync(3000);
      await expect(answer).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
