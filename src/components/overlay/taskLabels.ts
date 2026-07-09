import type { MessageKey } from '@/lib/i18n';
import type { DetectionCategory } from '@/lib/detection';

/** i18n key for each detection category's short tab/task label. */
export const TAB_LABEL_KEYS: Record<DetectionCategory, MessageKey> = {
  aiGenerated: 'badge_category_ai',
  violent: 'badge_category_violent',
  explicit: 'badge_category_explicit',
};
