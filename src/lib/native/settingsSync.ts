import { settings, type Settings } from '@/lib/settings/store';
import type { TargetsState } from '@/lib/detection';

/**
 * Guard's settings travelling between the extension and the container app (Safari only).
 *
 * The app shows and changes the settings below; the setup flags and the session travel separately.
 * They move as a whole set, and the newer side wins: the extension reports its set with the time it last
 * changed, and the app answers with its own set and the time it was made only when that is newer, so
 * the reply carries settings only when they should be taken.
 *
 * The extension has no record of when a setting changed, so the time is noted at report time: every
 * settings write triggers a report, and the report compares the settings with those of the last one.
 */

/** The settings the app shows and changes; the app expects exactly these fields. */
export type SyncedSettings = Pick<
  Settings,
  | 'isActive'
  | 'targets'
  | 'detectionAction'
  | 'useDetectorLocalModel'
  | 'verificatorSpace'
  | 'exceptionSites'
>;

/** When the synced settings last changed in the extension, in ms; `null` before any change was seen. */
export const settingsChangedAt = storage.defineItem<number | null>('local:settingsChangedAt', {
  fallback: null
});

/** The synced settings as of the last report, to notice a change between two reports. */
const lastReportedSettings = storage.defineItem<string | null>('local:lastReportedSettings', {
  fallback: null
});

/** The synced part of the settings, always in the same key order so two snapshots compare as text. */
export function syncedSettings(current: Settings): SyncedSettings {
  return {
    isActive: current.isActive,
    targets: {
      aiGenerated: current.targets.aiGenerated,
      violent: current.targets.violent,
      explicit: current.targets.explicit
    },
    detectionAction: current.detectionAction,
    useDetectorLocalModel: current.useDetectorLocalModel,
    verificatorSpace: current.verificatorSpace,
    exceptionSites: [...current.exceptionSites]
  };
}

/**
 * Notes a change since the last report and answers when the settings last changed.
 *
 * The first report after an install or update knows nothing about when they changed and answers
 * `null`, so a change the app made meanwhile (its own setup) wins.
 *
 * @param current - The synced settings now
 * @param now - The time of this report
 */
export async function noteSettingsChange(current: SyncedSettings, now = Date.now()): Promise<number | null> {
  const snapshot = JSON.stringify(current);
  const [previous, changedAt] = await Promise.all([
    lastReportedSettings.getValue(),
    settingsChangedAt.getValue()
  ]);
  if (previous === snapshot) return changedAt;
  if (previous === null) {
    await lastReportedSettings.setValue(snapshot);
    return changedAt;
  }
  await Promise.all([lastReportedSettings.setValue(snapshot), settingsChangedAt.setValue(now)]);
  return now;
}

/** What the app's reply carries when its settings should be taken. */
export interface AppSettingsReply {
  settings?: unknown;
  settingsChangedAt?: unknown;
  completesSetup?: unknown;
}

const ACTIONS: ReadonlyArray<Settings['detectionAction']> = ['mark', 'blur', 'hide'];

function isTargets(value: unknown): value is TargetsState {
  const targets = value as Record<string, unknown> | null;
  return (
    !!targets &&
    typeof targets.aiGenerated === 'boolean' &&
    typeof targets.violent === 'boolean' &&
    typeof targets.explicit === 'boolean'
  );
}

/**
 * Reads the app's settings, or `null` when anything is missing or malformed: a half-read set would be
 * written over the real one. Refuses a set with every target off, which no screen allows.
 */
export function parseSyncedSettings(value: unknown): SyncedSettings | null {
  const candidate = value as Record<string, unknown> | null;
  if (
    !candidate ||
    typeof candidate.isActive !== 'boolean' ||
    !isTargets(candidate.targets) ||
    !ACTIONS.includes(candidate.detectionAction as Settings['detectionAction']) ||
    typeof candidate.useDetectorLocalModel !== 'boolean' ||
    !(candidate.verificatorSpace === null || typeof candidate.verificatorSpace === 'string') ||
    !Array.isArray(candidate.exceptionSites) ||
    !candidate.exceptionSites.every((site) => typeof site === 'string')
  ) {
    return null;
  }
  const { aiGenerated, violent, explicit } = candidate.targets;
  if (!aiGenerated && !violent && !explicit) return null;

  return syncedSettings({
    ...(candidate as unknown as Settings),
    targets: { aiGenerated, violent, explicit }
  });
}

/**
 * Takes the settings the app sent, keeping the session and everything else.
 *
 * Notes them as reported and stamps the app's time before writing, so the report this write triggers
 * shows them unchanged and the app sees them applied.
 *
 * @returns Whether settings were taken
 */
export async function applyAppSettings(reply: AppSettingsReply | undefined): Promise<boolean> {
  const incoming = parseSyncedSettings(reply?.settings);
  const changedAt = reply?.settingsChangedAt;
  if (!incoming || typeof changedAt !== 'number' || !Number.isFinite(changedAt)) return false;

  const current = await settings.getValue();
  const next: Settings = {
    ...current,
    ...incoming,
    ...(reply?.completesSetup === true ? { hasCompletedSetup: true, hasPromptedSetup: true } : {})
  };

  await Promise.all([
    lastReportedSettings.setValue(JSON.stringify(syncedSettings(next))),
    settingsChangedAt.setValue(changedAt)
  ]);
  await settings.setValue(next);
  return true;
}
