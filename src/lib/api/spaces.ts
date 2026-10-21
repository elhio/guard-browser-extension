import { fetchWithAuth } from './client';
import { categoryForTargetName } from '@/lib/verification/eligibility';
import type { DetectionCategory } from '@/lib/detection';

/**
 * Represents a workspace or environment configured for content verification
 *
 * @property id - The unique identifier for the space
 * @property status - The current operational status of the space (e.g., 'active', 'archived')
 * @property created_at - The ISO 8601 timestamp of when the space was created
 * @property name - The human-readable display name of the space
 * @property description - A detailed explanation of the space's purpose or rules, if provided
 * @property slug - A URL-friendly string derived from the space name
 * @property url_id - A unique short identifier used for public URLs or sharing links
 * @property is_default - True if this is the fallback or primary space for the user/organization
 * @property is_public - True if this space is accessible by users outside the owner's account
 * @property user_id - The ID of the individual user who owns the space, if applicable
 * @property user_name - The display name of the user who owns the space, if applicable
 * @property organization_id - The ID of the organization that owns the space, if applicable
 * @property organization_name - The name of the organization that owns the space, if applicable
 * @property predictor_id - The unique identifier of the AI model or evaluation pipeline assigned to this space
 * @property predictor_name - The human-readable name of the assigned predictor model
 * @property enabled_media - An array of media types (e.g., 'image', 'video') supported by this specific space
 * @property enabled_target_names - An array of moderation targets (e.g., 'AI-Generated', 'Explicit', 'Violent') enabled here
 */
export interface SpacePublic {
  id: string;
  status: string;
  created_at: string;
  name: string;
  description: string | null;
  slug: string;
  url_id: string;
  is_default: boolean;
  is_public: boolean;
  user_id: string | null;
  user_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  predictor_id: string;
  predictor_name: string | null;
  enabled_media: string[];
  enabled_target_names: string[];
}

/**
 * A paginated or list-based API response payload containing multiple spaces
 *
 * @property data - An array of space objects returned by the API
 * @property count - The total number of spaces matching the query
 */
export interface SpacesPublic {
  data: SpacePublic[];
  count: number;
}

/**
 * Retrieves a list of all spaces associated with a specific user.
 *
 * @param userId - The unique identifier of the user whose spaces are being queried
 * @returns A promise that resolves to an array of public space objects
 */
export async function fetchUserSpaces(userId: string): Promise<SpacePublic[]> {
  const res = await fetchWithAuth<SpacesPublic>('/api/v1/spaces', { user_id: userId });
  return res.data || [];
}

/** A single detection target enabled on a space (name localized to the request locale). */
export interface TargetPublic {
  id: string;
  name: string;
  description?: string;
  /** Predefined "expected result" reactions: integer key → localized label. */
  reactions?: Record<number, string>;
}

/** Resolved per-target metadata used to interpret verification results and offer feedback. */
export interface SpaceTargetMeta {
  category: DetectionCategory | null;
  reactions: Record<number, string>;
}

/** Detailed space, including the concrete target list needed to resolve verification results. */
export interface SpaceDetailPublic {
  id: string;
  name: string;
  enabled_targets: TargetPublic[];
}

const SPACE_DETAIL_TTL_MS = 10 * 60 * 1000;
const spaceDetailCache = new Map<string, { expires: number; detail: SpaceDetailPublic }>();

/** Fetches a space's detail, memoized per space id for {@link SPACE_DETAIL_TTL_MS}. */
export async function fetchSpaceDetail(spaceId: string): Promise<SpaceDetailPublic> {
  const cached = spaceDetailCache.get(spaceId);
  if (cached && cached.expires > Date.now()) return cached.detail;

  const detail = await fetchWithAuth<SpaceDetailPublic>(`/api/v1/spaces/${spaceId}`);
  spaceDetailCache.set(spaceId, { expires: Date.now() + SPACE_DETAIL_TTL_MS, detail });
  return detail;
}

/**
 * Builds a `target_id → { category, reactions }` map for a space, used to place verification
 * results on the right tab and to offer per-target "expected result" reactions in feedback.
 */
export async function getSpaceTargetMeta(
  spaceId: string
): Promise<Record<string, SpaceTargetMeta>> {
  const detail = await fetchSpaceDetail(spaceId);
  const map: Record<string, SpaceTargetMeta> = {};
  for (const target of detail.enabled_targets ?? []) {
    map[target.id] = {
      category: categoryForTargetName(target.name),
      reactions: target.reactions ?? {},
    };
  }
  return map;
}