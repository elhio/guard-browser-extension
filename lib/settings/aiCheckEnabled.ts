import type { Browser } from '@wxt-dev/browser';

const AI_CHECK_ENABLED_KEY = 'guard.aiCheck';

/**
 * Whether the local-model fallback ("Mit KI prüfen") is offered on images the
 * automatic detection found nothing on. Defaults to on.
 */
export async function isAiCheckEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get({ [AI_CHECK_ENABLED_KEY]: true });
  return stored[AI_CHECK_ENABLED_KEY] as boolean;
}

export async function setAiCheckEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [AI_CHECK_ENABLED_KEY]: enabled });
}

/** Calls `callback` whenever the AI-check flag changes (e.g. from the popup toggle). */
export function onAiCheckEnabledChange(callback: (enabled: boolean) => void): () => void {
  function listener(changes: Record<string, Browser.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'local' || !(AI_CHECK_ENABLED_KEY in changes)) return;
    callback((changes[AI_CHECK_ENABLED_KEY].newValue as boolean | undefined) ?? true);
  }

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
