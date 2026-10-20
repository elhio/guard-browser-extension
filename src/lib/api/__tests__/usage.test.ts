import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import { fetchSubscription, fetchUserUsage } from '../usage';
import { settings } from '@/lib/settings/store';
import { ACCESS_TOKEN, respondWith, seedSignedIn } from '@/test-utils/session';

describe('fetchSubscription', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  // The API has no "no subscription" body — a free user simply 404s. Surfacing that as an error would
  // put every free account on the failure path
  it('resolves to null on 404', async () => {
    vi.stubGlobal('fetch', respondWith(404, { detail: 'No active subscription found' }));

    await expect(fetchSubscription()).resolves.toBeNull();
    // Guards the scoping of the identity rule: a 404 ends the session on `/users/me` and must go on
    // meaning "free plan" here
    expect((await settings.getValue()).token).toBe(ACCESS_TOKEN);
  });

  it('returns the subscription on success', async () => {
    vi.stubGlobal('fetch', respondWith(200, { plan_name: 'Individual', allow_bundle_purchases: true }));

    await expect(fetchSubscription()).resolves.toEqual({
      plan_name: 'Individual',
      allow_bundle_purchases: true,
    });
  });

  // Only 404 is a state; every other status is still a failure and must not read as "free plan"
  it.each([429, 500])('still throws on %i', async (status) => {
    vi.stubGlobal('fetch', respondWith(status));

    await expect(fetchSubscription()).rejects.toThrow();
  });

  it('still clears the session on 401', async () => {
    vi.stubGlobal('fetch', respondWith(401));

    await expect(fetchSubscription()).rejects.toThrow();

    expect((await settings.getValue()).token).toBeNull();
  });
});

describe('fetchUserUsage', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await seedSignedIn();
  });

  it('returns the token counts', async () => {
    const usage = {
      base_tokens: 1000,
      purchased_tokens: 500,
      rewarded_tokens: 100,
      consumed_tokens: 250,
    };
    vi.stubGlobal('fetch', respondWith(200, usage));

    await expect(fetchUserUsage()).resolves.toEqual(usage);
  });
});
