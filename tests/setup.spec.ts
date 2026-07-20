import { test, expect, readSettings } from "./fixtures";
import { setupWizard } from "./pages/setup";

test("completing the wizard (skip login) persists the chosen settings", async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  const wizard = setupWizard(page, extensionId);
  await wizard.goto();

  // Step 1: skip the account link.
  await expect(wizard.loginWebsiteButton()).toBeVisible();
  await wizard.skipLogin();

  // Step 2: tasks — turn "explicit" off, leave AI + violent on, then continue.
  await expect(wizard.taskCheckbox("aiGenerated")).toBeChecked();
  await wizard.taskCheckbox("explicit").uncheck();
  await wizard.next();

  // Step 3: action — choose "blur".
  await wizard.actionRadio("blur").check();
  await wizard.next();

  // Step 4: default detector — keep defaults.
  await wizard.next();

  // Step 5: verificator — skip (no space selected while unauthenticated).
  await wizard.next();

  // Step 6: summary — finish.
  await wizard.finish();

  await expect
    .poll(() => readSettings(serviceWorker).then((s) => s.hasCompletedSetup))
    .toBe(true);

  const settings = await readSettings(serviceWorker);
  expect(settings.isLoggedIn).toBe(false);
  expect(settings.detectionAction).toBe("blur");
  expect(settings.tasks).toEqual({ aiGenerated: true, violent: true, explicit: false });
});
