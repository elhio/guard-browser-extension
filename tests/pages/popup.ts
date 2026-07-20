import type { Page } from "@playwright/test";

/** Thin page object for the popup menu (popup.html). */
export function popup(page: Page, extensionId: string) {
  return {
    goto: () => page.goto(`chrome-extension://${extensionId}/popup.html`),

    statusToggle: () => page.getByTestId("popup-status-toggle"),
    toggleStatus: () => page.getByTestId("popup-status-toggle").click(),

    openHandling: () => page.getByTestId("popup-handling-summary").click(),
    selectAction: (action: "mark" | "blur" | "hide") =>
      page.getByTestId(`popup-action-${action}`).check(),

    openSettings: () => page.getByTestId("popup-open-settings").click(),
  };
}
