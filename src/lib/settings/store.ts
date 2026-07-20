import type { TasksState } from '@/lib/detection';

/**
 * The visual action taken when content is flagged
 */
export type DetectionAction = 'mark' | 'blur' | 'hide';

/**
 * The unified configuration state for the entire extension
 *
 * @property token - The authentication token for the external API, if the user is logged in
 * @property isLoggedIn - True if the user has successfully authenticated
 * @property tasks - Defines which specific moderation checks (AI, Violence, Explicit) are currently active
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
  isLoggedIn: boolean;
  tasks: TasksState;
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
  isLoggedIn: false,
  tasks: { aiGenerated: true, violent: true, explicit: true },
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
  }
);