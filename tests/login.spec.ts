import {
  test,
  expect,
  seedSettings,
  readSettings,
  WEBSITE_ORIGIN,
  WEBSITE_STUB_HTML,
} from "./fixtures";
import { setupWizard } from "./pages/setup";

/**
 * A stand-in for the real login site. The extension content script is injected here (it
 * matches every http(s) page) and, because this page's origin is the configured
 * VITE_WEBSITE_URL (http://localhost:5173), the content script accepts an EXT_AUTH_SUCCESS
 * message and forwards the session to the extension. The test posts the session itself, once —
 * posting more than once would call the wizard's onSuccess repeatedly.
 */
const LOGIN_STUB_HTML = `<!doctype html><html><body>login stub</body></html>`;

const TEST_TOKEN = "e2e-test-token";

test("logging in via the website handoff stores the token and advances the wizard", async ({
  page,
  context,
  extensionId,
  serviceWorker,
}) => {
  // Stub the website login page (source of the token) and the verificator API (step 5).
  await context.route("http://localhost:5173/**", (route) =>
    route.fulfill({ contentType: "text/html", body: LOGIN_STUB_HTML })
  );
  await context.route("http://localhost:8000/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"data":[]}' })
  );

  const wizard = setupWizard(page, extensionId);
  await wizard.goto();

  // Click "Log in on the website" and capture the tab it opens.
  const [loginTab] = await Promise.all([
    context.waitForEvent("page"),
    wizard.loginWebsiteButton().click(),
  ]);

  // Stand in for the user finishing the login form: the site posts the token well after load.
  await loginTab.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });
  await loginTab.evaluate((token) => {
    window.postMessage(
      { type: "EXT_AUTH_SUCCESS", token, expiresIn: 600, refreshToken: "rt_e2e" },
      "*"
    );
  }, TEST_TOKEN);

  // On success the extension closes the login tab and the wizard advances to step 2 (targets).
  await loginTab.waitForEvent("close");
  await expect(wizard.targetCheckbox("aiGenerated")).toBeVisible();

  // Advance to the summary step, then finish; the token is persisted on completion.
  const finishButton = page.getByTestId("wizard-finish");
  for (let i = 0; i < 6 && (await finishButton.count()) === 0; i++) {
    await wizard.next();
  }
  await wizard.finish();

  await expect
    .poll(() => readSettings(serviceWorker).then((s) => s.token))
    .toBe("e2e-test-token");
  const stored = await readSettings(serviceWorker);
  expect(stored.refreshToken).toBe("rt_e2e");
  expect(stored.isLoggedIn).toBe(true);
});

/**
 * The badge-menu path: signed out, onboarding already finished, and no extension page open anywhere.
 *
 * This used to lose the login entirely. `TOKEN_RECEIVED` was only listened for by the options page
 * and the setup wizard, so a sign-in started from the in-page menu — which opens the login tab via
 * the background and leaves no extension page around — was dropped, and the tab stayed open on the
 * dashboard. The background now stores the session and closes the tab.
 *
 * Opening the page here rather than letting the extension open it is also what makes the
 * already-authenticated timing case testable at all: the site posts during page load, and a tab
 * created by `browser.tabs.create` is already navigating before `context.route` can intercept it.
 */
test("stores the session and closes the tab with no extension page open", async ({
  context,
  serviceWorker,
}) => {
  await context.route(`${WEBSITE_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: "text/html", body: WEBSITE_STUB_HTML })
  );

  // Past onboarding but signed out — the state the badge menu's "Sign in to verify" is used in.
  await seedSettings(serviceWorker, {
    hasCompletedSetup: true,
    hasPromptedSetup: true,
  });

  // A separate tab, not the `page` fixture: the extension closes this one, which would otherwise
  // break teardown.
  const loginTab = await context.newPage();
  await loginTab.goto(`${WEBSITE_ORIGIN}/en/login?source=extension`);
  await loginTab.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });

  // Armed before posting: the background closes this tab almost immediately, and a listener
  // attached afterwards would be waiting for an event that has already fired.
  const tabClosed = loginTab.waitForEvent("close", { timeout: 10_000 });

  // Stand in for the site posting a session, as it does on load for an already-signed-in user (one
  // it started for the extension with POST /auth/sessions).
  await loginTab.evaluate((token) => {
    window.postMessage(
      { type: "EXT_AUTH_SUCCESS", token, expiresIn: 600, refreshToken: "rt_badge" },
      "*"
    );
  }, "badge-menu-token");

  // The website waits ~500ms after posting for the extension to do exactly this.
  await tabClosed;

  const stored = await readSettings(serviceWorker);
  expect(stored.token).toBe("badge-menu-token");
  expect(stored.refreshToken).toBe("rt_badge");
  expect(stored.isLoggedIn).toBe(true);
});

/**
 * An access token alone lives for minutes, so storing one would sign the user out shortly after
 * signing them in. It is what a website from before the extension's own sessions posted.
 */
test("ignores a handover without a refresh token", async ({ context, serviceWorker }) => {
  await context.route(`${WEBSITE_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: "text/html", body: WEBSITE_STUB_HTML })
  );
  await seedSettings(serviceWorker, { hasCompletedSetup: true, hasPromptedSetup: true });

  const loginTab = await context.newPage();
  await loginTab.goto(`${WEBSITE_ORIGIN}/en/login?source=extension`);
  await loginTab.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });

  await loginTab.evaluate(() => {
    window.postMessage({ type: "EXT_AUTH_SUCCESS", token: "access-only" }, "*");
  });

  // Nothing should happen, so wait out the message round-trip before asserting it didn't.
  await loginTab.waitForTimeout(1_000);
  const stored = await readSettings(serviceWorker);
  expect(stored.token).toBeNull();
  expect(stored.isLoggedIn).toBe(false);
  await loginTab.close();
});
