import { sendToApp } from './nativeApplication';

/**
 * The cheap check that brings the container app's changes over at once (Safari only).
 *
 * iOS has no way for an app to message its Safari extension, so Guard asks. The app keeps a revision
 * number and raises it whenever it changes something Guard has to take: Guard's settings, or signing in
 * or out. Guard remembers the revision of the last full report and sends it along; the native part
 * compares the two and answers `changed`. Only then does the background send its full report
 * (`reportState.ts`), whose reply carries the changes.
 */

/** A check reads two numbers; anything slower means the native part is gone. */
const CHECK_TIMEOUT_MS = 3000;

/** The app's revision as of the last full report; `null` before the first one. */
export const appRevision = storage.defineItem<number | null>('local:appRevision', {
  fallback: null
});

/** Whether the app changed something since the last full report. Unreachable counts as no change. */
export async function checkAppForChanges(): Promise<boolean> {
  try {
    const revision = await appRevision.getValue();
    const reply = (await sendToApp({ type: 'sync', revision }, CHECK_TIMEOUT_MS)) as
      | { changed?: unknown }
      | undefined;
    return reply?.changed === true;
  } catch (error) {
    console.warn('[Guard] Could not check the app for changes:', error);
    return false;
  }
}

/** Notes the revision a report's reply carries, so the next check compares against it. */
export async function noteAppRevision(reply: { revision?: unknown } | undefined): Promise<void> {
  if (typeof reply?.revision === 'number' && Number.isFinite(reply.revision)) {
    await appRevision.setValue(reply.revision);
  }
}
