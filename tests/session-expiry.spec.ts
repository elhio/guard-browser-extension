import {
  test,
  expect,
  seedSettings,
  readSettings,
  API_ORIGIN,
  type Settings,
} from "./fixtures";
import { settingsDashboard } from "./pages/settings";
import type { BrowserContext } from "@playwright/test";

/**
 * A token the API will refuse. Deliberately not shaped like a JWT, so these specs exercise the
 * network path rather than the local expiry short-circuit — that one is covered by the unit tests
 * for `isTokenExpired` and by the `expired token` case at the bottom.
 */
const DEAD_TOKEN = "e2e-dead-token";

const SIGNED_IN: Partial<Settings> = {
  token: DEAD_TOKEN,
  isLoggedIn: true,
  verificatorSpace: "e2e-space",
  hasCompletedSetup: true,
  isActive: true,
};

/**
 * Answers `/users/me` with one status and everything else with an empty success, so each spec varies
 * only the thing under test. The catch-all is registered first because Playwright matches routes in
 * reverse registration order.
 */
async function stubIdentity(
  context: BrowserContext,
  status: number,
  detail: string
): Promise<void> {
  await context.route(`${API_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await context.route(
    (url) => url.origin === API_ORIGIN && url.pathname === "/api/v1/users/me",
    (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ detail }),
      })
  );
}

/**
 * What the settings page must never show once the API has refused to identify the token: the
 * signed-in card with every field fallen back to a placeholder — a "?" avatar, the name "User" and a
 * plan nobody is on. That render is the bug these specs exist for.
 */
async function expectSignedOut(dashboard: ReturnType<typeof settingsDashboard>) {
  await expect(dashboard.accountSignIn()).toBeVisible();
  await expect(dashboard.accountIdentityName()).toHaveCount(0);
  await expect(dashboard.verificationLoginRequired()).toBeVisible();
}

test.beforeEach(async ({ serviceWorker }) => {
  await seedSettings(serviceWorker, SIGNED_IN);
});

/**
 * The three ways the API refuses a stored token. Only the first produced a 401 and so was the only
 * one the extension ever recovered from; the other two verify perfectly and still name nobody, which
 * is what left the card claiming a session that no longer existed.
 */
const REJECTED = [
  { label: "an expired or revoked token", status: 401, detail: "Could not validate credentials" },
  { label: "a deactivated account", status: 400, detail: "Inactive user" },
  { label: "a deleted account", status: 404, detail: "User not found" },
];

for (const { label, status, detail } of REJECTED) {
  test(`${label} renders as signed out and drops the session`, async ({
    page,
    context,
    extensionId,
    serviceWorker,
  }) => {
    await stubIdentity(context, status, detail);

    const dashboard = settingsDashboard(page, extensionId);
    await dashboard.goto();

    await expectSignedOut(dashboard);

    // The rest of the extension reads storage, so the in-page menu and the verify path have to end
    // up agreeing with the card rather than holding a token it has already disowned.
    const after = await readSettings(serviceWorker);
    expect(after.token).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    expect(after.verificatorSpace).toBeNull();
    // A session ending is not a reason to forget the user's preferences.
    expect(after.hasCompletedSetup).toBe(true);
  });
}

/**
 * A server that is down says nothing about the credential, so the user stays signed in. What they
 * must not get is the identity row, whose placeholders would state things about an account nobody
 * managed to read.
 *
 * 500 stands in for the whole transient class here; 429 and a dropped connection take the same path,
 * and the status matrix in `src/lib/api/__tests__/accounts.test.ts` is what pins which is which.
 */
test("an unreachable API keeps the user signed in", async ({
  page,
  context,
  extensionId,
  serviceWorker,
}) => {
  await stubIdentity(context, 500, "boom");

  const dashboard = settingsDashboard(page, extensionId);
  await dashboard.goto();

  await expect(dashboard.accountUnavailable()).toBeVisible();
  await expect(dashboard.accountIdentityName()).toHaveCount(0);
  await expect(dashboard.accountSignIn()).toHaveCount(0);
  await expect(dashboard.verificationUnavailable()).toBeVisible();
  await expect(dashboard.verificationLoginRequired()).toHaveCount(0);

  // The session is intact, so it must come back on its own once the API does.
  expect((await readSettings(serviceWorker)).token).toBe(DEAD_TOKEN);
});

/** The way out for a user stuck on an unreachable API: retry, and the card fills itself in. */
test("retrying an unreachable API restores the account", async ({
  page,
  context,
  extensionId,
}) => {
  let identityFails = true;
  await context.route(`${API_ORIGIN}/**`, (route) => {
    const isIdentity = new URL(route.request().url()).pathname === "/api/v1/users/me";

    if (isIdentity && identityFails) {
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: isIdentity
        ? JSON.stringify({
            id: "u1",
            name: "ada",
            full_name: "Ada Lovelace",
            active_plan_name: "Individual",
            is_restricted: false,
          })
        : "{}",
    });
  });

  const dashboard = settingsDashboard(page, extensionId);
  await dashboard.goto();
  await expect(dashboard.accountUnavailable()).toBeVisible();

  identityFails = false;
  await dashboard.accountRetry().click();

  await expect(dashboard.accountIdentityName()).toHaveText("Ada Lovelace");
  await expect(dashboard.accountUnavailable()).toHaveCount(0);
});

/**
 * A token whose own deadline has passed needs no round trip to be recognised. This is what makes the
 * signed-out state correct for a user who is offline, and immediate for everyone else.
 */
test("a token past its expiry is recognised without calling the API", async ({
  page,
  context,
  extensionId,
  serviceWorker,
}) => {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiredToken = [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 * 60 * 24 }),
    "signature",
  ].join(".");

  await seedSettings(serviceWorker, { ...SIGNED_IN, token: expiredToken });

  const identityCalls: string[] = [];
  await context.route(`${API_ORIGIN}/**`, (route) => {
    identityCalls.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const dashboard = settingsDashboard(page, extensionId);
  await dashboard.goto();

  await expectSignedOut(dashboard);

  expect(identityCalls).not.toContain("/api/v1/users/me");
  expect((await readSettings(serviceWorker)).token).toBeNull();
});
