import { test, expect, seedSettings, readSettings } from "./fixtures";
import { popup } from "./pages/popup";

test.beforeEach(async ({ serviceWorker }) => {
  // Skip onboarding so the popup renders its normal menu.
  await seedSettings(serviceWorker, { hasCompletedSetup: true, isActive: true });
});

test("toggling the status switch disables scanning", async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  const menu = popup(page, extensionId);
  await menu.goto();

  await expect(menu.statusToggle()).toBeEnabled();
  await menu.toggleStatus();

  await expect.poll(() => readSettings(serviceWorker).then((s) => s.isActive)).toBe(false);
});

test("changing the handling action updates the stored action", async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  const menu = popup(page, extensionId);
  await menu.goto();

  await menu.openHandling();
  await menu.selectAction("blur");

  await expect
    .poll(() => readSettings(serviceWorker).then((s) => s.detectionAction))
    .toBe("blur");
});
