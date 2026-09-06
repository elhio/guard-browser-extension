import { t } from '@/lib/i18n';
import { clearSession } from '@/lib/settings/store';
import { ApiError, fetchWithAuth } from './client';

/**
 * Represents the authenticated user's profile information retrieved from the API
 *
 * @property id - The unique identifier for the user
 * @property name - The user's handle, which is the segment the website's profile route is keyed on
 * @property full_name - The user's full display name
 * @property avatar_url - The URL pointing to the user's profile picture, if one exists
 * @property active_plan_name - The name of the user's current subscription or access plan (e.g.,
 *   'Individual'). Absent until the profile loads, and for an account with no active subscription
 * @property is_restricted - Whether the account is barred from buying. The API enforces this itself
 *   (a purchase from a restricted account is rejected), so the flag exists here only to stop the UI
 *   offering a route the server will refuse
 */
export interface UserProfile {
  id: string;
  name: string;
  full_name: string;
  avatar_url?: string | null;
  active_plan_name: string;
  is_restricted: boolean;
}

/**
 * The statuses `/users/me` answers when the stored token can never name a user again.
 *
 * 401 is absent because `request` already handles it for every endpoint: it is the one status that
 * means "session over" no matter who asked. These two mean it only on the identity endpoint, which
 * is exactly why the rule lives here rather than being widened in the client.
 *
 *   400 "Inactive user"  - the account was deactivated. The token itself still verifies, so no call
 *                          will ever produce the 401 that would otherwise have cleaned this up.
 *   404 "User not found" - the token verifies but the account behind it is gone.
 */
const IDENTITY_REJECTED_STATUSES: readonly number[] = [400, 404];

/**
 * Whether an error means the session is finished, as opposed to the call merely having failed.
 *
 * Callers use it to render the signed-out state directly instead of waiting for the storage write to
 * come back round through `settings.watch`, and to stop React Query retrying a token that will be
 * refused identically every time.
 *
 * @param error - Anything thrown by an API call
 */
export function isSessionRejected(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  return error.status === 401 || IDENTITY_REJECTED_STATUSES.includes(error.status);
}

let cachedUserId: { token: string; id: string } | undefined;

/**
 * Retrieves the profile details of the currently authenticated user
 *
 * Ends the session when the API refuses to identify the token. Without this a deactivated or deleted
 * account keeps its token in storage forever, and every screen goes on drawing a signed-in shell
 * around a profile that will never arrive.
 *
 * @param token - A valid authentication token used to authorize the API request
 * @returns A promise that resolves to the user's profile data
 * @throws {ApiError} Rethrown from the request. A rejected identity is re-thrown carrying the same
 *   wording as a 401, so the reason shown to the user does not depend on which status caused it.
 */
export async function fetchUserProfile(token: string): Promise<UserProfile> {
  try {
    return await fetchWithAuth<UserProfile>('/api/v1/users/me', token);
  } catch (error) {
    if (error instanceof ApiError && IDENTITY_REJECTED_STATUSES.includes(error.status)) {
      // The memoized id belongs to an account the API has just disowned, so the next lookup must
      // ask again rather than hand it back
      cachedUserId = undefined;
      await clearSession();
      throw new ApiError(t('auth_error_session_expired'), error.status);
    }
    throw error;
  }
}

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
