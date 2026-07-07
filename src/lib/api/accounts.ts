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