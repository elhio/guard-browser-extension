import type { Browser } from '@wxt-dev/browser';

const HOVER_UNBLUR_ENABLED_KEY = 'guard.blur.hoverUnblur';

/** Whether hovering over a blurred image should temporarily unblur it. Defaults to off. */
export async function isHoverUnblurEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get({ [HOVER_UNBLUR_ENABLED_KEY]: false });
  return stored[HOVER_UNBLUR_ENABLED_KEY] as boolean;
}

export async function setHoverUnblurEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [HOVER_UNBLUR_ENABLED_KEY]: enabled });
}

/** Calls `callback` whenever the hover-unblur flag changes (e.g. from the popup toggle). */
export function onHoverUnblurEnabledChange(callback: (enabled: boolean) => void): () => void {
  function listener(changes: Record<string, Browser.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'local' || !(HOVER_UNBLUR_ENABLED_KEY in changes)) return;
    callback((changes[HOVER_UNBLUR_ENABLED_KEY].newValue as boolean | undefined) ?? false);
  }

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
