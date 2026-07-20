import type { SpacePublic } from '@/lib/api';
import type { DetectionCategory, TasksState } from '@/lib/detection';

/**
 * The `enabled_task_names` values (as returned by the backend, per locale) that
 * count as covering each detection category. Matching is driven by category key
 * rather than a localized display string.
 */
const SPACE_TASK_NAMES: Record<DetectionCategory, string[]> = {
  aiGenerated: ['AI-Generated', 'AI-Generiert'],
  violent: ['Violent', 'Gewalttätig'],
  explicit: ['Explicit', 'Explizit'],
};

/**
 * Maps an external verification task label (e.g. "AI-Generated", "Gewalttätig") back
 * to the detection category it covers, or `null` if it matches no known category.
 */
export function categoryForTaskLabel(label: string): DetectionCategory | null {
  const normalized = label.trim().toLowerCase();
  for (const category of Object.keys(SPACE_TASK_NAMES) as DetectionCategory[]) {
    if (SPACE_TASK_NAMES[category].some((name) => name.toLowerCase() === normalized)) {
      return category;
    }
  }
  return null;
}

/**
 * Why a space is not usable: either it doesn't support images, or it is missing
 * one of the user's enabled detection categories.
 */
export type EligibilityReason = 'media' | DetectionCategory;

export interface SpaceEligibility {
  eligible: boolean;
  reason?: EligibilityReason;
}

/**
 * Checks whether a verification space supports image media and every task the
 * user has enabled. Returns a semantic `reason` the caller localizes itself.
 */
export function checkSpaceEligibility(space: SpacePublic, tasks: TasksState): SpaceEligibility {
  if (!space.enabled_media?.includes('image')) {
    return { eligible: false, reason: 'media' };
  }

  const enabledTaskNames = space.enabled_task_names || [];

  for (const category of Object.keys(SPACE_TASK_NAMES) as DetectionCategory[]) {
    const covered = enabledTaskNames.some((name) => SPACE_TASK_NAMES[category].includes(name));
    if (tasks[category] && !covered) {
      return { eligible: false, reason: category };
    }
  }

  return { eligible: true };
}

/**
 * Localized strings needed to render a space's dynamic description. Each surface
 * supplies its own translations so this stays i18n-agnostic.
 */
export interface SpaceDescriptionLabels {
  and: string;
  mediaImage: string;
  mediaVideo: string;
  fallbackModel: string;
  /** Template containing `{tasks}`, `{media}` and `{predictor}` placeholders. */
  template: string;
  noDescFallback: string;
}

function joinWithAnd(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return items.slice(0, -1).join(', ') + and + items[items.length - 1];
}

/**
 * Builds the human-readable description of what a space verifies, falling back to
 * the space's own description (or a generic string) when data is incomplete.
 */
export function formatSpaceDescription(space: SpacePublic, labels: SpaceDescriptionLabels): string {
  const formattedTasks = joinWithAnd(space.enabled_task_names || [], labels.and);

  const media = (space.enabled_media || []).map((m) =>
    m === 'image' ? labels.mediaImage : m === 'video' ? labels.mediaVideo : m
  );
  const formattedMedia = joinWithAnd(media, labels.and);

  if (!formattedTasks || !formattedMedia) {
    return space.description || labels.noDescFallback;
  }

  return labels.template
    .replace('{tasks}', formattedTasks)
    .replace('{media}', formattedMedia)
    .replace('{predictor}', space.predictor_name || labels.fallbackModel);
}
