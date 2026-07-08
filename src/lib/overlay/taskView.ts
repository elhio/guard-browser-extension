import { passesThreshold } from '@/lib/detection';
import type { DetectionCategory } from '@/lib/detection';
import { t, type MessageKey } from '@/lib/i18n';
import type { OverlayEntry } from './store';

/** The resolved view of one task tab (score/label/description), for the menu to render. */
export interface TaskView {
  score: number;
  isAlert: boolean;
  label: string;
  description: string;
  pending: boolean;
}

const TIER_KEYS: Record<DetectionCategory, { none: MessageKey; possible: MessageKey; strong: MessageKey }> = {
  aiGenerated: {
    none: 'menu_signal_none_ai',
    possible: 'menu_signal_possible_ai',
    strong: 'menu_signal_strong_ai',
  },
  violent: {
    none: 'menu_signal_none_violent',
    possible: 'menu_signal_possible_violent',
    strong: 'menu_signal_strong_violent',
  },
  explicit: {
    none: 'menu_signal_none_explicit',
    possible: 'menu_signal_possible_explicit',
    strong: 'menu_signal_strong_explicit',
  },
};

/** Qualitative 3-tier label for a local/metadata score (none / possible / strong, split at the threshold). */
function tierLabel(category: DetectionCategory, score: number): string {
  const keys = TIER_KEYS[category];
  if (score <= 0) return t(keys.none);
  if (!passesThreshold(category, score)) return t(keys.possible);
  return t(keys.strong);
}

/**
 * Resolves what a task tab should show. A completed external verification replaces the
 * local/metadata result for any category its returned items map to.
 */
export function resolveTaskView(category: DetectionCategory, entry: OverlayEntry | null): TaskView {
  const verify = entry?.verify;

  if (verify?.state === 'done' && verify.data) {
    const item = verify.data.results.find((result) => result.category === category);
    if (item) {
      return {
        score: item.score,
        isAlert: passesThreshold(category, item.score),
        label: item.label,
        description: item.description ?? '',
        pending: false,
      };
    }
  }

  const score = entry?.result?.categories?.[category]?.confidence ?? 0;
  return {
    score,
    isAlert: passesThreshold(category, score),
    label: tierLabel(category, score),
    description: '',
    pending: verify?.state === 'pending',
  };
}
