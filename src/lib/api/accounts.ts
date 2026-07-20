import { fetchWithAuth } from './client';

/**
 * Represents the authenticated user's profile information retrieved from the API
 *
 * @property id - The unique identifier for the user
 * @property full_name - The user's full display name
 * @property avatar_url - The URL pointing to the user's profile picture, if one exists
 * @property active_plan_name - The name of the user's current subscription or access plan (e.g., 'Free', 'Pro')
 */
export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  active_plan_name: string;
}

/**
 * Retrieves the profile details of the currently authenticated user
 *
 * @param token - A valid authentication token used to authorize the API request
 * @returns A promise that resolves to the user's profile data
 */
export async function fetchUserProfile(token: string): Promise<UserProfile> {
  return fetchWithAuth<UserProfile>('/api/v1/users/me', token);
}

let cachedUserId: { token: string; id: string } | undefined;

/**
 * Resolves the authenticated user's id, memoized per token so repeated calls
 * (e.g. one per image verification) don't refetch the profile.
 *
 * @param token - A valid authentication token
 * @returns The user's unique id
 */
export async function getUserId(token: string): Promise<string> {
  if (cachedUserId?.token === token) return cachedUserId.id;
  const { id } = await fetchUserProfile(token);
  cachedUserId = { token, id };
  return id;
}