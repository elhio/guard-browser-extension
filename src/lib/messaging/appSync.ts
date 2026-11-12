/** Routing id for a page or the popup asking the background to check the container app for changes. */
export const APP_SYNC_MESSAGE = 'APP_SYNC';

/**
 * Asks the background whether the container app changed something Guard has to take (Safari only).
 *
 * The app can't message the extension on iOS, so Guard asks at the moments a change could matter: a
 * page opening, the user coming back to Safari or to a tab, the popup opening. The background answers
 * from a cheap revision check and only reports in full when something changed (`appSync.ts` in
 * `lib/native`).
 */
export interface AppSyncRequest {
  type: typeof APP_SYNC_MESSAGE;
}

/** Type guard for {@link AppSyncRequest}. */
export function isAppSyncRequest(message: unknown): message is AppSyncRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === APP_SYNC_MESSAGE
  );
}

/**
 * Lets a check through at most once per `intervalMs`.
 *
 * A return to Safari fires both `visibilitychange` and `focus`, and a page load can follow right
 * behind; one check covers them all.
 */
export function createCheckGate(intervalMs: number, now: () => number = Date.now) {
  let last = Number.NEGATIVE_INFINITY;
  return {
    /** Whether a check may run now; counts it as run when it may. */
    tryPass(): boolean {
      const time = now();
      if (time - last < intervalMs) return false;
      last = time;
      return true;
    },
    /** Counts a check as just run (a full report checks too). */
    mark(): void {
      last = now();
    }
  };
}
