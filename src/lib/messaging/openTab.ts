import { browser } from 'wxt/browser';

/** Routing id for asking the background to open a URL in a new tab. */
export const OPEN_TAB_MESSAGE = 'OPEN_TAB';

export interface OpenTabRequest {
  type: typeof OPEN_TAB_MESSAGE;
  url: string;
}

/** Type guard for {@link OpenTabRequest}. */
export function isOpenTabRequest(message: unknown): message is OpenTabRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === OPEN_TAB_MESSAGE &&
    typeof (message as Record<string, unknown>).url === 'string'
  );
}

/**
 * Asks the background to open a URL in a new tab. Used by the content-script menu,
 * since content scripts can't reliably open tabs / the options page themselves.
 */
export function openTab(url: string): void {
  void browser.runtime.sendMessage({ type: OPEN_TAB_MESSAGE, url } satisfies OpenTabRequest);
}
