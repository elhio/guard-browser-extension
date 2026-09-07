import { browser } from 'wxt/browser';

/** Routing id for asking the background to hand the container app what it needs to sell tokens. */
export const STORE_HANDOVER_MESSAGE = 'STORE_HANDOVER';

export interface StoreHandoverRequest {
  type: typeof STORE_HANDOVER_MESSAGE;
}

export interface StoreHandoverResponse {
  /** Whether the app can now read the credentials. False means the bridge could not be reached. */
  success: boolean;
}

/** Type guard for {@link StoreHandoverRequest}. */
export function isStoreHandoverRequest(message: unknown): message is StoreHandoverRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === STORE_HANDOVER_MESSAGE
  );
}

/**
 * Asks the background to park the session credentials where the container app can collect them.
 *
 * Safari only, and a round trip rather than a fire-and-forget: the caller launches the app the
 * moment this resolves, so the credentials have to be in place before it returns. Only the
 * background may talk to the native handler, which is why the options page cannot do this itself.
 *
 * @returns Whether the handover landed. A false answer means the app will find nothing and show its
 *   own "open Settings in Safari" message, which is why the caller launches it either way.
 */
export async function requestStoreHandover(): Promise<boolean> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: STORE_HANDOVER_MESSAGE
    } satisfies StoreHandoverRequest)) as StoreHandoverResponse | undefined;

    return response?.success ?? false;
  } catch {
    return false;
  }
}
