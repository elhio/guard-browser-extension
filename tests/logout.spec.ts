import {
  test,
  expect,
  seedSettings,
  readSettings,
  signedIn,
  API_ORIGIN,
  WEBSITE_ORIGIN,
  WEBSITE_STUB_HTML,
} from "./fixtures";

/**
 * An origin the extension must never accept a logout from. Deliberately differs from the website
 * only by port: the origin check used to compare protocol and hostname alone, which trusted every
 * other dev server on localhost.
 */
const FOREIGN_ORIGIN = "http://localhost:5199";

const SIGNED_IN = {
  ...signedIn(),
  verificatorSpace: "e2e-space",
  hasCompletedSetup: true,
  hasPromptedSetup: true,
};

/**
 * The website's logout signal must reach the extension with no extension page open.
 *
 * This is the whole point of handling it in the background rather than in the settings page: the
 * user is on the website when they log out or delete their account, and the options page is almost
 * always closed. A version of this that lived in a React component would pass a test that happened
 * to have the options tab open, and fail every real user.
 */
test.describe("website logout handoff", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(`${WEBSITE_ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: WEBSITE_STUB_HTML })
    );
  });

  test("clears the stored session when the website signs the user out", async ({
    page,
    serviceWorker,
  }) => {
    await seedSettings(serviceWorker, SIGNED_IN);

    await page.goto(`${WEBSITE_ORIGIN}/`);
    await page.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: "EXT_AUTH_LOGOUT", reason: "logout" }, "*");
    });

    await expect.poll(() => readSettings(serviceWorker).then((s) => s.token)).toBeNull();

    const after = await readSettings(serviceWorker);
    expect(after.refreshToken).toBeNull();
    expect(after.isLoggedIn).toBe(false);
    // Bound to the account that just left — it must not carry over to whoever signs in next.
    expect(after.verificatorSpace).toBeNull();
    // Local preferences are not part of the session and must survive.
    expect(after.hasCompletedSetup).toBe(true);
  });

  // The extension's session is its own (the website started it for the extension), so the website
  // logging out of its session leaves it running unless the extension ends it at the API too.
  test("ends the extension's own session at the API", async ({ page, context, serviceWorker }) => {
    const logouts: unknown[] = [];
    await context.route(`${API_ORIGIN}/api/v1/auth/logout`, (route) => {
      logouts.push({
        body: route.request().postDataJSON(),
        transport: route.request().headers()["x-token-transport"],
      });
      return route.fulfill({ status: 204 });
    });
    await seedSettings(serviceWorker, SIGNED_IN);

    await page.goto(`${WEBSITE_ORIGIN}/`);
    await page.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: "EXT_AUTH_LOGOUT", reason: "logout" }, "*");
    });

    await expect.poll(() => logouts.length).toBe(1);
    expect(logouts[0]).toEqual({ body: { refresh_token: "rt_e2e" }, transport: "body" });
  });

  test("clears the stored session after account deletion", async ({ page, serviceWorker }) => {
    await seedSettings(serviceWorker, SIGNED_IN);

    await page.goto(`${WEBSITE_ORIGIN}/`);
    await page.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: "EXT_AUTH_LOGOUT", reason: "account_deleted" }, "*");
    });

    await expect.poll(() => readSettings(serviceWorker).then((s) => s.token)).toBeNull();
  });

  // The content script runs on every page, so the origin gate is the only thing standing between a
  // hostile site and the ability to sign our users out at will.
  test("ignores the same message from any other origin", async ({
    page,
    context,
    serviceWorker,
  }) => {
    await context.route(`${FOREIGN_ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: WEBSITE_STUB_HTML })
    );
    await seedSettings(serviceWorker, SIGNED_IN);

    await page.goto(`${FOREIGN_ORIGIN}/`);
    await page.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: "EXT_AUTH_LOGOUT", reason: "logout" }, "*");
    });

    // Nothing should happen, so wait out the message round-trip before asserting it didn't.
    await page.waitForTimeout(1_000);
    expect((await readSettings(serviceWorker)).token).toBe("e2e-test-token");
  });
});
