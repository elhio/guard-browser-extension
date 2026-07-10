import { test, expect, readSettings } from "./fixtures";
import { setupWizard } from "./pages/setup";

/**
 * A stand-in for the real login site. The extension content script is injected here (it
 * matches every http(s) page) and, because this page's origin is the configured
 * VITE_WEBSITE_URL (http://localhost:5173), the content script accepts an EXT_AUTH_SUCCESS
 * message and forwards the token to the extension. The test posts the token itself, once,
 * after the content script has mounted (see below) — posting more than once would call the
 * wizard's onSuccess repeatedly.
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

  // Wait until the content script has mounted its shadow host — its window "message" listener
  // is registered right after — then post the token exactly once.
  await loginTab.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });
  await loginTab.evaluate((token) => {
    window.postMessage({ type: "EXT_AUTH_SUCCESS", token }, "*");
  }, TEST_TOKEN);

  // On success the extension closes the login tab and the wizard advances to step 2 (tasks).
  await loginTab.waitForEvent("close");
  await expect(wizard.taskCheckbox("aiGenerated")).toBeVisible();

  // Advance to the summary step, then finish; the token is persisted on completion.
  const finishButton = page.getByTestId("wizard-finish");
  for (let i = 0; i < 6 && (await finishButton.count()) === 0; i++) {
    await wizard.next();
  }
  await wizard.finish();

  await expect
    .poll(() => readSettings(serviceWorker).then((s) => s.token))
    .toBe("e2e-test-token");
  expect((await readSettings(serviceWorker)).isLoggedIn).toBe(true);
});
