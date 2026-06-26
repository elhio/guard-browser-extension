import type { Browser } from '@wxt-dev/browser';

const GUARD_ENABLED_KEY = 'guard.enabled';

/** Whether image scanning/C2PA detection should run at all. Defaults to on. */
export async function isGuardEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get({ [GUARD_ENABLED_KEY]: true });
  return stored[GUARD_ENABLED_KEY] as boolean;
}

export async function setGuardEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [GUARD_ENABLED_KEY]: enabled });
}

/** Calls `callback` whenever the enabled flag changes (e.g. from the popup toggle). */
export function onGuardEnabledChange(callback: (enabled: boolean) => void): () => void {
  function listener(changes: Record<string, Browser.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'local' || !(GUARD_ENABLED_KEY in changes)) return;
    callback((changes[GUARD_ENABLED_KEY].newValue as boolean | undefined) ?? true);
  }

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
