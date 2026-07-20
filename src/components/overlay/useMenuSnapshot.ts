import { useSyncExternalStore } from 'react';

import { subscribe, getSnapshot, type MenuSnapshot } from '@/lib/overlay/store';

/** Subscribes the menu to the overlay store. */
export function useMenuSnapshot(): MenuSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
