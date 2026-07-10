import { test, expect, seedSettings, readSettings } from "./fixtures";
import { settingsDashboard } from "./pages/settings";

test.beforeEach(async ({ serviceWorker }) => {
  // options.html renders the dashboard only once setup is complete.
  await seedSettings(serviceWorker, {
    hasCompletedSetup: true,
    isActive: true,
    detectionAction: "mark",
  });
});

test("changing the flag action on the settings page persists it", async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  const dashboard = settingsDashboard(page, extensionId);
  await dashboard.goto();

  await expect(dashboard.actionCheckbox("mark")).toBeChecked();
  await dashboard.selectAction("blur");

  await expect
    .poll(() => readSettings(serviceWorker).then((s) => s.detectionAction))
    .toBe("blur");
  await expect(dashboard.actionCheckbox("blur")).toBeChecked();
});

test("toggling the master status on the settings page persists it", async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  const dashboard = settingsDashboard(page, extensionId);
  await dashboard.goto();

  await dashboard.toggleStatus();

  await expect.poll(() => readSettings(serviceWorker).then((s) => s.isActive)).toBe(false);
});
