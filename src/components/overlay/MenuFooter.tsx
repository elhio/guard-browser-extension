import { useReducer, useState } from 'react';
import { browser } from 'wxt/browser';
import { LuChevronDown } from 'react-icons/lu';

import { t } from '@/lib/i18n';
import { runVerify, type OverlayEntry, type OverlaySettings } from '@/lib/overlay/store';
import {
  getCurrentAction,
  hideImage,
  isImageFlaggedForAction,
  isImageRevealed,
  revealImage,
} from '@/lib/overlay/applyAction';
import { openTab } from '@/lib/messaging/openTab';

interface MenuAction {
  kind: string;
  label: string;
  run: () => void;
  disabled?: boolean;
}

interface MenuFooterProps {
  entry: OverlayEntry;
  settings: OverlaySettings;
  /** Whether feedback/share actions can be offered (a verified task is on the active tab). */
  canFeedback: boolean;
  onFeedback: (isPositive: boolean) => void;
  onShare: () => void;
}

/** The teal split-button: a context-dependent primary action + a dropdown of the rest. */
export function MenuFooter({ entry, settings, canFeedback, onFeedback, onShare }: MenuFooterProps) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState(false);

  const element = entry.element;
  const signedIn = !!settings.token;
  const canVerify = !!(settings.token && settings.verificatorSpace);
  const action = getCurrentAction();
  const actionable = isImageFlaggedForAction(element) && (action === 'blur' || action === 'hide');
  const revealed = isImageRevealed(element);
  const revealable = actionable && !revealed;
  const rehidable = actionable && revealed;
  const verifying = entry.verify.state === 'pending';
  const verifyDone = entry.verify.state === 'done';

  const revealAction: MenuAction = {
    kind: 'reveal',
    label: t('menu_action_reveal'),
    run: () => { revealImage(element); force(); },
  };
  const hideAction: MenuAction = {
    kind: 'hide',
    label: t('menu_action_hide'),
    run: () => { hideImage(element); force(); },
  };
  const signinAction: MenuAction = {
    kind: 'signin',
    label: t('menu_action_signin'),
    run: () => openTab(import.meta.env.VITE_WEBSITE_URL),
  };

  // Primary: Verify → Unblur → context prompt (Sign in / Choose a space).
  // Verify is disabled while running and after it completes (the image is already verified).
  let primary: MenuAction;
  if (verifying) {
    primary = { kind: 'verifying', label: t('menu_action_verifying'), run: () => {}, disabled: true };
  } else if (canVerify) {
    primary = { kind: 'verify', label: t('menu_action_verify'), run: () => { void runVerify(entry.src); }, disabled: verifyDone };
  } else if (revealable) {
    primary = revealAction;
  } else if (!signedIn) {
    primary = signinAction;
  } else {
    primary = {
      kind: 'choose_space',
      label: t('menu_action_choose_space'),
      run: () => openTab(browser.runtime.getURL('/options.html')),
    };
  }

  // Secondary actions (from Reveal/re-hide + Sign in), minus whatever is already primary.
  const secondaries: MenuAction[] = [];
  if (revealable && primary.kind !== 'reveal') secondaries.push(revealAction);
  if (rehidable) secondaries.push(hideAction);
  if (!signedIn && primary.kind !== 'signin') secondaries.push(signinAction);

  // Post-verification feedback + share (only when the active tab has a verified task).
  if (canFeedback) {
    secondaries.push({ kind: 'mark_correct', label: t('menu_action_mark_correct'), run: () => onFeedback(true) });
    secondaries.push({ kind: 'mark_incorrect', label: t('menu_action_mark_incorrect'), run: () => onFeedback(false) });
    secondaries.push({ kind: 'share', label: t('menu_action_share'), run: () => onShare() });
  }

  const hasSecondary = secondaries.length > 0;

  return (
    <div className="relative flex">
      <button
        type="button"
        onClick={primary.run}
        disabled={primary.disabled}
        className={`flex flex-1 cursor-pointer items-center justify-center bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors enabled:hover:bg-teal-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${
          hasSecondary ? 'rounded-l-md' : 'rounded-md'
        }`}
      >
        {primary.label}
      </button>

      {hasSecondary && (
        <>
          <button
            type="button"
            aria-label={t('menu_more_actions')}
            onClick={() => setOpen((value) => !value)}
            className="flex cursor-pointer items-center rounded-r-md border-l border-teal-500 bg-teal-600 px-2 text-white transition-colors hover:bg-teal-700 focus:outline-none"
          >
            <LuChevronDown size={16} />
          </button>

          {open && (
            <div
              data-menu-dropdown
              className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-[#111111]"
            >
              {secondaries.map((secondary) => (
                <button
                  key={secondary.kind}
                  type="button"
                  onClick={() => { secondary.run(); setOpen(false); }}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {secondary.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
