import { fetchWithAuth } from './client';

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
 * @property enabled_task_names - An array of moderation tasks (e.g., 'AI-Generated', 'Explicit', 'Violent') enabled here
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
  enabled_task_names: string[];
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
 * @param token - A valid authentication token used to authorize the API request
 * @param userId - The unique identifier of the user whose spaces are being queried
 * @returns A promise that resolves to an array of public space objects
 */
export async function fetchUserSpaces(token: string, userId: string): Promise<SpacePublic[]> {
  const res = await fetchWithAuth<SpacesPublic>('/api/v1/spaces/', token, { user_id: userId });
  return res.data || [];
}