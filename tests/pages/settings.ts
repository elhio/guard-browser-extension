import type { Page } from "@playwright/test";

/** Thin page object for the settings dashboard (options.html, when setup is complete). */
export function settingsDashboard(page: Page, extensionId: string) {
  return {
    goto: () => page.goto(`chrome-extension://${extensionId}/options.html`),

    statusToggle: () => page.getByTestId("settings-status-toggle"),
    toggleStatus: () => page.getByTestId("settings-status-toggle").click(),

    actionCheckbox: (action: "mark" | "blur" | "hide") =>
      page.getByTestId(`settings-action-${action}`),
    selectAction: (action: "mark" | "blur" | "hide") =>
      page.getByTestId(`settings-action-${action}`).check(),
  };
}
