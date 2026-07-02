import type { Browser } from '@wxt-dev/browser';

const BLUR_ENABLED_KEY = 'guard.blur.enabled';

/** Whether images flagged as likely AI-generated should additionally be blurred. Defaults to off. */
export async function isBlurEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get({ [BLUR_ENABLED_KEY]: false });
  return stored[BLUR_ENABLED_KEY] as boolean;
}

export async function setBlurEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [BLUR_ENABLED_KEY]: enabled });
}

/** Calls `callback` whenever the blur flag changes (e.g. from the popup toggle). */
export function onBlurEnabledChange(callback: (enabled: boolean) => void): () => void {
  function listener(changes: Record<string, Browser.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'local' || !(BLUR_ENABLED_KEY in changes)) return;
    callback((changes[BLUR_ENABLED_KEY].newValue as boolean | undefined) ?? false);
  }

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
