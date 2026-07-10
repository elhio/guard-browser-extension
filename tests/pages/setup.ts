import type { Page } from "@playwright/test";

/**
 * Thin page object for the onboarding wizard (setup.html). Buttons are located by the
 * `data-testid` hooks added to the wizard/login/card components, so selectors are
 * independent of the display locale.
 */
export function setupWizard(page: Page, extensionId: string) {
  return {
    goto: () => page.goto(`chrome-extension://${extensionId}/setup.html`),

    // Step 1 — login
    loginWebsiteButton: () => page.getByTestId("login-website"),
    skipLogin: () => page.getByTestId("login-skip").click(),

    // Step 2 — tasks (CheckboxCard -> checkbox-<taskId>)
    taskCheckbox: (taskId: "aiGenerated" | "violent" | "explicit") =>
      page.getByTestId(`checkbox-${taskId}`),

    // Step 3 — action (RadioCard -> radio-<action>)
    actionRadio: (action: "mark" | "blur" | "hide") => page.getByTestId(`radio-${action}`),

    // Navigation
    next: () => page.getByTestId("wizard-next").click(),
    back: () => page.getByTestId("wizard-back").click(),
    finish: () => page.getByTestId("wizard-finish").click(),
  };
}
