/** Routing id for a page or the popup asking the background for a token of the app's session. */
export const APP_TOKEN_MESSAGE = 'APP_TOKEN';

/**
 * Asks the background for an access token of the container app's session (Safari only).
 *
 * Only the background may talk to the native part, so pages and the popup ask here
 * (`fetchAppToken` in `lib/native/appSession.ts`).
 */
export interface AppTokenRequest {
  type: typeof APP_TOKEN_MESSAGE;
  /** A token the API just refused, or that ran out; never handed back. */
  rejected: string | null;
}

/** A fresh token, or why there is none: the app signed out, or it could not renew right now. */
export type AppTokenResponse = { token: string } | { error: 'signedOut' | 'unavailable' };

/** Type guard for {@link AppTokenRequest}. */
export function isAppTokenRequest(message: unknown): message is AppTokenRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === APP_TOKEN_MESSAGE
  );
}
