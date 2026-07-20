import { test as base, chromium, type BrowserContext, type Worker } from "@playwright/test";
import path from "path";

/** The production build the fixture loads as an unpacked extension. Run `wxt build` first. */
const pathToExtension = path.resolve(".output/chrome-mv3");

/** Minimal mirror of the extension's Settings shape (see src/lib/settings/store.ts). */
export interface Settings {
  token: string | null;
  isLoggedIn: boolean;
  tasks: { aiGenerated: boolean; violent: boolean; explicit: boolean };
  detectionAction: "mark" | "blur" | "hide";
  useDetectorLocalModel: boolean;
  verificatorSpace: string | null;
  hasCompletedSetup: boolean;
  hasPromptedSetup: boolean;
  isActive: boolean;
  exceptionSites: string[];
}

/** Matches `defaultSettings` in the extension so seeded state renders like a real install. */
export const defaultSettings: Settings = {
  token: null,
  isLoggedIn: false,
  tasks: { aiGenerated: true, violent: true, explicit: true },
  detectionAction: "mark",
  useDetectorLocalModel: false,
  verificatorSpace: null,
  hasCompletedSetup: false,
  hasPromptedSetup: false,
  isActive: true,
  exceptionSites: [],
};

/** `chrome` as seen inside the extension service worker (where the storage callbacks run). */
declare const chrome: {
  storage: {
    local: {
      get(keys: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
}>({
  context: async ({}, use) => {
    // Extensions require a headed, persistent context; Chromium is the only supported target.
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    // chrome-extension://<id>/background.js -> the id is the URL host.
    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;

/** Writes a full Settings object (defaults + overrides) into the extension's storage. */
export async function seedSettings(
  serviceWorker: Worker,
  overrides: Partial<Settings> = {}
): Promise<void> {
  const value: Settings = { ...defaultSettings, ...overrides };
  await serviceWorker.evaluate(
    (settings) => chrome.storage.local.set({ settings }),
    value
  );
}

/** Reads the extension's current Settings back out of storage. */
export async function readSettings(serviceWorker: Worker): Promise<Settings> {
  const value = await serviceWorker.evaluate(() =>
    chrome.storage.local.get("settings").then((result) => result.settings)
  );
  return value as Settings;
}
