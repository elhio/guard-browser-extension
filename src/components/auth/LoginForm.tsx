import { useState, useEffect, useRef, useCallback } from 'react';
import { browser } from 'wxt/browser';

import { t } from '@/lib/i18n';
import { websiteAuthUrl } from '@/lib/website/urls';
import ElhioLogo from '@/assets/elhio.svg?react';
import { Button } from '@/components/ui/Button';

interface TokenMessage {
  type: string;
  token?: string;
}

interface MessageSender {
  tab?: {
    id?: number;
  };
}

interface LoginFormProps {
  onSuccess: (token: string) => void;
  onSkip: () => void;
}

export function LoginForm({ onSuccess, onSkip }: LoginFormProps) {
  const [isWaiting, setIsWaiting] = useState(false);

  const loginTabId = useRef<number | undefined>(undefined);

  const loginUrl = websiteAuthUrl('login');
  const signupUrl = websiteAuthUrl('signup');

  const returnToWizard = useCallback(async (senderTabId?: number) => {
    const tabId = senderTabId ?? loginTabId.current;
    loginTabId.current = undefined;

    if (tabId != null) {
      await browser.tabs.remove(tabId).catch(console.error);
    }

    const wizardTab = await browser.tabs.getCurrent().catch(() => undefined);
    if (wizardTab?.id != null) {
      await browser.tabs.update(wizardTab.id, { active: true }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    const handleMessage = (message: TokenMessage, sender: MessageSender) => {
      if (message.type === 'TOKEN_RECEIVED' && message.token) {
        void returnToWizard(sender.tab?.id);
        onSuccess(message.token);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [onSuccess, returnToWizard]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (isWaiting) {
      timer = setTimeout(() => {
        setIsWaiting(false);
      }, 10000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isWaiting]);

  const handleExternalAuth = async (targetUrl: string) => {
    setIsWaiting(true);

    const tab = await browser.tabs.create({ url: targetUrl, active: true });
    loginTabId.current = tab.id;
  };

  return (
    <div className="w-full max-w-sm mx-auto animate-in fade-in slide-in-from-right-2 duration-300">

      <div className="flex flex-col gap-8">

        <div className="self-center w-[clamp(4rem,10vh,8rem)]">
          <ElhioLogo className="w-full h-auto text-teal-600" />
        </div>

        <div className="flex flex-col items-center gap-4 mb-4">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            {t("login_heading")}
          </h2>
          <p className="text-center text-sm text-gray-500">
            {t("login_subheading")}
          </p>
        </div>

        {/* Action Buttons are now always rendered */}
        <div className="flex flex-col gap-4">

          {/* Main Button with the isLoading prop */}
          <Button
            onClick={() => handleExternalAuth(loginUrl)}
            type="button"
            isLoading={isWaiting}
            data-testid="login-website"
          >
            {t("login_btn_website")}
          </Button>

          {/* Skip Button disabled while waiting */}
          <button
            type="button"
            data-testid="login-skip"
            onClick={onSkip}
            disabled={isWaiting}
            className="w-full flex justify-center items-center px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("login_btn_skip")}
          </button>

          {/* Register Link disabled while waiting */}
          <p className="text-xs font-medium text-center text-gray-500 mt-2">
            {t("login_no_account")}{' '}
            <button
              type="button"
              onClick={() => handleExternalAuth(signupUrl)}
              disabled={isWaiting}
              className="text-teal-600 hover:text-teal-700 focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("login_register_link")}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}