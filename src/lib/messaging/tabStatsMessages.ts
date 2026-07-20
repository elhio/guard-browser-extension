/**
 * The identifier the popup uses to ask the active tab's content script for its per-page scan counts.
 */
export const GET_TAB_STATS_MESSAGE = 'GET_TAB_STATS_MESSAGE';

/**
 * Per-page image counts, derived from the content script's overlay store.
 *
 * @property checked - Images that finished a successful scan (not in-flight, not errored).
 * @property flagged - Images detected over threshold (a subset of `checked`).
 */
export interface TabStats {
  checked: number;
  flagged: number;
}

/** Request sent from the popup to a content script to read the current page's {@link TabStats}. */
export interface GetTabStatsRequest {
  type: typeof GET_TAB_STATS_MESSAGE;
}

/** The content script replies with a plain {@link TabStats}. */
export type GetTabStatsResponse = TabStats;

function hasMessageType(message: unknown, type: string): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === type
  );
}

/** Type Guard: checks whether an incoming generic message is a {@link GetTabStatsRequest}. */
export function isGetTabStatsRequest(message: unknown): message is GetTabStatsRequest {
  return hasMessageType(message, GET_TAB_STATS_MESSAGE);
}
