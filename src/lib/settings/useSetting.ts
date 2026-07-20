import { useEffect, useState } from 'react';

import { settings, defaultSettings, type Settings } from './store';

/**
 * Reads a single value from the shared `local:settings` object, keeps it in sync
 * with storage changes, and persists updates back (merging into the full object).
 *
 * Replaces the repeated `getValue()` + `watch()` + `setValue({...current, key})`
 * effect that every settings surface would otherwise hand-roll.
 *
 * @param key - The setting to read/write
 * @returns A `[value, setValue]` tuple, `useState`-style
 */
export function useSetting<K extends keyof Settings>(
  key: K
): [Settings[K], (value: Settings[K]) => Promise<void>] {
  const [value, setLocalValue] = useState<Settings[K]>(defaultSettings[key]);

  useEffect(() => {
    let active = true;

    settings.getValue().then((current) => {
      if (active) setLocalValue(current[key]);
    });

    const unwatch = settings.watch((next) => {
      if (next && active) setLocalValue(next[key]);
    });

    return () => {
      active = false;
      unwatch();
    };
  }, [key]);

  const setValue = async (next: Settings[K]): Promise<void> => {
    setLocalValue(next);
    const current = await settings.getValue();
    await settings.setValue({ ...current, [key]: next });
  };

  return [value, setValue];
}
