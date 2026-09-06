import { ApiError, fetchWithAuth } from './client';

/**
 * The token budget and consumption for the authenticated user's current billing cycle.
 *
 * The API returns more than this (processed media, leaderboard standing, cycle bounds); only the
 * fields the account card renders are modelled, so an unrelated change to the payload cannot break
 * the extension's type checking.
 *
 * @property base_tokens - Tokens granted by the plan itself
 * @property purchased_tokens - Tokens bought on top of the plan as bundles
 * @property rewarded_tokens - Tokens earned rather than paid for
 * @property consumed_tokens - Tokens spent so far this cycle
 */
export interface UserUsage {
  base_tokens: number;
  purchased_tokens: number;
  rewarded_tokens: number;
  consumed_tokens: number;
}

/**
 * The authenticated user's active subscription.
 *
 * @property plan_name - The subscription's plan, e.g. 'Individual'
 * @property allow_bundle_purchases - Whether this plan may buy token bundles, which decides between
 *   the "Buy tokens" and "Upgrade your plan" call to action
 */
export interface Subscription {
  plan_name: string;
  allow_bundle_purchases: boolean;
}

/**
 * Retrieves the authenticated user's token usage for the current cycle.
 *
 * @param token - A valid authentication token
 */
export async function fetchUserUsage(token: string): Promise<UserUsage> {
  return fetchWithAuth<UserUsage>('/api/v1/users/me/usage', token);
}

/**
 * Retrieves the authenticated user's active subscription, or `null` when there is none.
 *
 * The API answers 404 rather than an empty body for a user without an active subscription, which is
 * the ordinary state of everyone on the free plan. Translating that one status into `null` keeps a
 * free account off the error path, where React Query would retry it and the card would have to treat
 * a real outage and a free plan identically.
 *
 * @param token - A valid authentication token
 */
export async function fetchSubscription(token: string): Promise<Subscription | null> {
  try {
    return await fetchWithAuth<Subscription>('/api/v1/users/me/subscription', token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
