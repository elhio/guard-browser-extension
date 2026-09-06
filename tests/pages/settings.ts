import type { Page } from "@playwright/test";

/** Thin page object for the settings dashboard (options.html, when setup is complete). */
export function settingsDashboard(page: Page, extensionId: string) {
  return {
    goto: () => page.goto(`chrome-extension://${extensionId}/options.html`),

    statusToggle: () => page.getByTestId("settings-status-toggle"),
    toggleStatus: () => page.getByTestId("settings-status-toggle").click(),

    accountSignIn: () => page.getByTestId("account-sign-in"),
    accountIdentityName: () => page.getByTestId("account-identity-name"),
    accountUnavailable: () => page.getByTestId("account-unavailable"),
    accountRetry: () => page.getByTestId("account-retry"),
    verificationLoginRequired: () => page.getByTestId("verification-login-required"),
    verificationUnavailable: () => page.getByTestId("verification-unavailable"),

    actionCheckbox: (action: "mark" | "blur" | "hide") =>
      page.getByTestId(`settings-action-${action}`),
    selectAction: (action: "mark" | "blur" | "hide") =>
      page.getByTestId(`settings-action-${action}`).check(),
  };
}
