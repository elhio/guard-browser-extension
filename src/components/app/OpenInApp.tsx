import { useEffect, useState, type ReactNode } from 'react';

import { t } from '@/lib/i18n';
import ElhioLogo from '@/assets/elhio.svg?react';
import { Button } from '@/components/ui/Button';

interface OpenInAppProps {
  /** The app's link for this page (`APP_SETTINGS_URL` or `APP_SETUP_URL`). */
  url: string;
  /** Which page this stands in for, for its wording. */
  page: 'settings' | 'setup';
  /** The page itself, shown when the user asks to stay in Safari. */
  children: ReactNode;
}

/**
 * On Safari, Guard's settings and setup live in the Elhio app: this page opens the app at once, says so,
 * and offers the extension's own page as a way out in case the app link doesn't open.
 */
export function OpenInApp({ url, page, children }: OpenInAppProps) {
  const [stayHere, setStayHere] = useState(false);

  useEffect(() => {
    window.location.href = url;
  }, [url]);

  if (stayHere) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-[#0c0a09]">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="self-center w-[clamp(4rem,10vh,8rem)]">
          <ElhioLogo className="h-auto w-full text-teal-600" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('open_in_app_title')}
          </h1>
          <p className="text-center text-sm text-gray-500" data-testid="open-in-app-body">
            {t(page === 'settings' ? 'open_in_app_settings_body' : 'open_in_app_setup_body')}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Button type="button" onClick={() => (window.location.href = url)} data-testid="open-in-app">
            {t('open_in_app_button')}
          </Button>
          <button
            type="button"
            onClick={() => setStayHere(true)}
            data-testid="open-in-app-stay"
            className="text-center text-xs font-medium text-teal-600 hover:text-teal-700 focus:underline focus:outline-none"
          >
            {t(page === 'settings' ? 'open_in_app_settings_here' : 'open_in_app_setup_here')}
          </button>
        </div>
      </div>
    </div>
  );
}
