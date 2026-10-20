import type { TargetsState } from '@/lib/detection';

/**
 * The visual action taken when content is flagged
 */
export type DetectionAction = 'mark' | 'blur' | 'hide';

/**
 * The unified configuration state for the entire extension
 *
 * @property token - The access token for the external API, if the user is logged in. It lives for
 *   minutes only; `lib/auth/session.ts` renews it with `refreshToken` and is the one place that should
 *   read it for a request
 * @property refreshToken - The refresh token of the extension's own session, rotated on every
 *   renewal. Present exactly while the user is signed in
 * @property tokenExpiresAt - When `token` runs out, in milliseconds since the epoch
 * @property isLoggedIn - True if the user has successfully authenticated
 * @property targets - Defines which specific moderation checks (AI, Violence, Explicit) are currently active
 * @property detectionAction - The visual action to take when content is flagged ('mark', 'blur', 'hide')
 * @property useDetectorLocalModel - True if the extension should run inference also on local model
 * @property verificatorSpace - The ID of the selected workspace/environment used for API verification
 * @property hasCompletedSetup - True if the user has finished the initial onboarding wizard
 * @property hasPromptedSetup - True once the wizard has been opened automatically. Distinct from
 *   `hasCompletedSetup`: it stays true even if the user closes the wizard without finishing, so the
 *   extension offers onboarding exactly once instead of reopening a tab every time it starts
 * @property isActive - The master kill-switch. If false, the extension will not scan any pages
 * @property exceptionSites - A list of hostnames (e.g., 'example.com') where the extension is explicitly disabled
 */
export interface Settings {
  token: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isLoggedIn: boolean;
  targets: TargetsState;
  detectionAction: DetectionAction;
  useDetectorLocalModel: boolean;
  verificatorSpace: string | null;
  hasCompletedSetup: boolean;
  hasPromptedSetup: boolean;
  isActive: boolean;
  exceptionSites: string[];
}

/**
 * The baseline configuration applied on first install or when storage is cleared
 */
export const defaultSettings: Settings = {
  token: null,
  refreshToken: null,
  tokenExpiresAt: null,
  isLoggedIn: false,
  targets: { aiGenerated: true, violent: true, explicit: true },
  detectionAction: 'mark',
  useDetectorLocalModel: false,
  verificatorSpace: null,
  hasCompletedSetup: false,
  hasPromptedSetup: false,
  // Ships disabled: the detector stays off until the onboarding wizard is finished, which flips this
  // (and `hasCompletedSetup`) to true. See the `shouldRun` gate in `entrypoints/content.ts`.
  isActive: false,
  exceptionSites: []
};

/**
 * The reactive storage instance for application settings
 */
export const settings = storage.defineItem<Settings>(
  'local:settings',
  {
    fallback: defaultSettings,
    version: 2,
    migrations: {
      // 0.0.4: the API's tasks became targets, and its long-lived access token a short one renewed
      // with a refresh token. A session from before has no refresh token and its token is refused,
      // so it ends here, with the workspace that belonged to it (as `clearSession` does)
      2: (old: Record<string, unknown>): Settings => {
        const { tasks, ...rest } = old;
        return {
          ...defaultSettings,
          ...(rest as Partial<Settings>),
          targets: (tasks as Settings['targets'] | undefined) ?? defaultSettings.targets,
          token: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isLoggedIn: false,
          verificatorSpace: null,
        };
      },
    },
  }
);

/**
 * Ends the signed-in session, leaving every other preference untouched.
 *
 * The single way the extension signs out, so the Logout button, the website's logout signal and a
 * 401 from the API all behave identically. Everything else reacts through `settings.watch`.
 *
 * `verificatorSpace` goes with the token: it is a workspace id belonging to the account that just
 * left, and would otherwise carry over to whoever signs in next.
 */
export async function clearSession(): Promise<void> {
  const current = await settings.getValue();

  if (
    !current.token &&
    !current.refreshToken &&
    !current.isLoggedIn &&
    !current.verificatorSpace
  ) {
    return;
  }

  await settings.setValue({
    ...current,
    token: null,
    refreshToken: null,
    tokenExpiresAt: null,
    isLoggedIn: false,
    verificatorSpace: null,
  });
}