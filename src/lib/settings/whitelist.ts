import type { Browser } from '@wxt-dev/browser';

const WHITELIST_KEY = 'guard.whitelist';

/** Hostnames (and their subdomains) where image scanning is skipped entirely. */
export async function getWhitelist(): Promise<string[]> {
  const stored = await browser.storage.local.get({ [WHITELIST_KEY]: [] as string[] });
  return stored[WHITELIST_KEY] as string[];
}

export async function setWhitelist(hosts: string[]): Promise<void> {
  await browser.storage.local.set({ [WHITELIST_KEY]: hosts });
}

export async function addToWhitelist(host: string): Promise<void> {
  const normalized = normalizeHost(host);
  if (!normalized) return;
  const current = await getWhitelist();
  if (current.includes(normalized)) return;
  await setWhitelist([...current, normalized]);
}

export async function removeFromWhitelist(host: string): Promise<void> {
  const current = await getWhitelist();
  await setWhitelist(current.filter((entry) => entry !== host));
}

/** Calls `callback` whenever the whitelist changes (e.g. from the popup). */
export function onWhitelistChange(callback: (hosts: string[]) => void): () => void {
  function listener(changes: Record<string, Browser.storage.StorageChange>, areaName: string): void {
    if (areaName !== 'local' || !(WHITELIST_KEY in changes)) return;
    callback((changes[WHITELIST_KEY].newValue as string[] | undefined) ?? []);
  }

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** Parses free-form user input ("example.com", "https://example.com/path") down to a bare hostname. */
export function normalizeHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** True if `hostname` is whitelisted directly or as a subdomain of a whitelisted entry. */
export function isHostWhitelisted(hostname: string, whitelist: string[]): boolean {
  const lower = hostname.toLowerCase();
  return whitelist.some((entry) => lower === entry || lower.endsWith(`.${entry}`));
}