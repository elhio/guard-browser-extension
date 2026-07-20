/** Routing id for the container app handing control back to the extension. */
export const APP_HANDOFF_MESSAGE = 'APP_HANDOFF';

/**
 * Marks the throwaway page the Apple container app opens to reach the extension.
 *
 * The app can't open the extension's own pages — iOS refuses `safari-web-extension://` URLs from an
 * app — so tapping "Setup" or "Settings" leaves the real instruction in the App Group and opens the
 * website carrying this marker. The content script recognises it and wakes the background, which
 * collects the instruction and then closes this page: it only ever existed to get us here.
 *
 * Without it the extension would only notice the instruction the next time its background happened
 * to load, which on a non-persistent page might be minutes later or not at all.
 */
export const APP_HANDOFF_PARAM = 'guard-handoff';

export interface AppHandoffRequest {
  type: typeof APP_HANDOFF_MESSAGE;
}

/** Type guard for {@link AppHandoffRequest}. */
export function isAppHandoffRequest(message: unknown): message is AppHandoffRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === APP_HANDOFF_MESSAGE
  );
}
