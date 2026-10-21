import { browser } from 'wxt/browser';

import { isSessionTokens, type SessionTokens } from '@/lib/auth/session';

/**
 * Routing id for the session the website handed over, relayed by the content script.
 *
 * The background stores it, and the onboarding wizard listens for it too, to move on.
 */
export const TOKEN_RECEIVED_MESSAGE = 'TOKEN_RECEIVED';

/** Routing id for the website's logout, relayed by the content script for the background to end. */
export const END_SESSION_MESSAGE = 'END_SESSION';

export interface TokenReceivedMessage extends SessionTokens {
  type: typeof TOKEN_RECEIVED_MESSAGE;
}

export interface EndSessionRequest {
  type: typeof END_SESSION_MESSAGE;
}

/** Type guard for {@link TokenReceivedMessage}: one carrying a whole session, nothing less. */
export function isTokenReceived(message: unknown): message is TokenReceivedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === TOKEN_RECEIVED_MESSAGE &&
    isSessionTokens(message)
  );
}

/** Type guard for {@link EndSessionRequest}. */
export function isEndSessionRequest(message: unknown): message is EndSessionRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === END_SESSION_MESSAGE
  );
}

/** Relays a handed-over session from the content script. */
export function relaySession(tokens: SessionTokens): void {
  void browser.runtime.sendMessage({
    type: TOKEN_RECEIVED_MESSAGE,
    token: tokens.token,
    expiresIn: tokens.expiresIn,
    refreshToken: tokens.refreshToken,
  } satisfies TokenReceivedMessage);
}

/**
 * Asks the background to end the session. The content script doesn't call the API itself: its
 * requests would go out as the page's, under the page's CORS rules.
 */
export function requestEndSession(): void {
  void browser.runtime.sendMessage({ type: END_SESSION_MESSAGE } satisfies EndSessionRequest);
}
