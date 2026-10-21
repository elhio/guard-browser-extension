import type { SpacePublic } from '@/lib/api';
import type { DetectionCategory, TargetsState } from '@/lib/detection';

/**
 * The `enabled_target_names` values (as returned by the backend, per locale) that
 * count as covering each detection category. Matching is driven by category key
 * rather than a localized display string.
 */
const SPACE_TARGET_NAMES: Record<DetectionCategory, string[]> = {
  aiGenerated: ['AI-Generated', 'AI-Generiert'],
  violent: ['Violent', 'Gewalttätig'],
  explicit: ['Explicit', 'Explizit'],
};

/**
 * Maps an external verification target label (e.g. "AI-Generated", "Gewalttätig") back
 * to the detection category it covers, or `null` if it matches no known category.
 */
export function categoryForTargetName(label: string): DetectionCategory | null {
  const normalized = label.trim().toLowerCase();
  for (const category of Object.keys(SPACE_TARGET_NAMES) as DetectionCategory[]) {
    if (SPACE_TARGET_NAMES[category].some((name) => name.toLowerCase() === normalized)) {
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
 * Checks whether a verification space supports image media and every target the
 * user has enabled. Returns a semantic `reason` the caller localizes itself.
 */
export function checkSpaceEligibility(space: SpacePublic, targets: TargetsState): SpaceEligibility {
  if (!space.enabled_media?.includes('image')) {
    return { eligible: false, reason: 'media' };
  }

  const enabledTargetNames = space.enabled_target_names || [];

  for (const category of Object.keys(SPACE_TARGET_NAMES) as DetectionCategory[]) {
    const covered = enabledTargetNames.some((name) => SPACE_TARGET_NAMES[category].includes(name));
    if (targets[category] && !covered) {
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
  /** Template containing `{targets}`, `{media}` and `{predictor}` placeholders. */
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
  const formattedTargets = joinWithAnd(space.enabled_target_names || [], labels.and);

  const media = (space.enabled_media || []).map((m) =>
    m === 'image' ? labels.mediaImage : m === 'video' ? labels.mediaVideo : m
  );
  const formattedMedia = joinWithAnd(media, labels.and);

  if (!formattedTargets || !formattedMedia) {
    return space.description || labels.noDescFallback;
  }

  return labels.template
    .replace('{targets}', formattedTargets)
    .replace('{media}', formattedMedia)
    .replace('{predictor}', space.predictor_name || labels.fallbackModel);
}
