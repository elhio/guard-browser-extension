import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { LuExternalLink, LuLogOut, LuLogIn } from 'react-icons/lu';
import SettingsSection from '@/components/ui/SettingsSection';
import { getAppLocale, t } from '@/lib/i18n';

interface UserData {
  full_name: string;
  avatar_url?: string | null;
  active_plan_name: string;
}

export function AccountSettingsCard() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  const websiteUrl = import.meta.env.VITE_WEBSITE_URL || '';
  const locale = getAppLocale();
  const loginUrl = `${websiteUrl}/${locale}/login?source=extension`;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const fetchUser = async () => {
    try {
      const storage = await browser.storage.local.get(['token']);
      const token = storage.token;

      if (!token) {
        setIsAuthenticated(false);
        setUserData(null);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);
      const baseUrl = import.meta.env.VITE_API_URL;

      const userResponse = await fetch(`${baseUrl}/api/v1/users/me?lang=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userResponse.ok) throw new Error('Failed to fetch user');

      const data = await userResponse.json();
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user:', error);
      setIsAuthenticated(false);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = async (message: any, sender: any) => {
      if (message.type === 'TOKEN_RECEIVED' && message.token) {
        if (sender.tab?.id) {
          browser.tabs.remove(sender.tab.id).catch(console.error);
        }

        await browser.storage.local.set({ token: message.token });

        setIsWaitingAuth(false);
        fetchUser();
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const handleLoginClick = async () => {
    setIsWaitingAuth(true);
    await browser.tabs.create({ url: loginUrl, active: true });
    setTimeout(() => setIsWaitingAuth(false), 10000);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleLogout = async () => {
    // Clear the token and selected space from local storage
    await browser.storage.local.remove(['token', 'selectedSpace']);
    setIsAuthenticated(false);
    setUserData(null);
  };

  const profileAction = (
    <a
      href={isAuthenticated ? `${websiteUrl}/settings/account` : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center transition-colors focus:outline-none -mr-0.5 ${
        isAuthenticated 
          ? 'text-gray-500 hover:text-gray-700 cursor-pointer' 
          : 'text-gray-500 pointer-events-none opacity-50'
      }`}
      title={isAuthenticated ? t('settings_account_profile_title') : t('settings_account_profile_disabled_title')}
      aria-label="Open profile in external tab"
    >
      <LuExternalLink size={18} />
    </a>
  );

  return (
    <SettingsSection title={t('settings_account_title')} action={profileAction}>

      {isLoading ? (
        <div className="flex flex-col animate-pulse py-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-full bg-gray-200 shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-px w-full bg-gray-100 mb-2" />
          <div className="flex items-center gap-3 py-2">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
        </div>

      ) : !isAuthenticated ? (
        // --- UNAUTHENTICATED STATE ---
        <button
          onClick={handleLoginClick}
          disabled={isWaitingAuth}
          className="flex items-center gap-3 py-3 w-full text-sm text-gray-700 hover:text-gray-900 transition-colors group cursor-pointer focus:outline-none disabled:opacity-50 text-left"
        >
          {isWaitingAuth ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800 ml-0.5" />
          ) : (
            <LuLogIn size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors" />
          )}
          <span className="font-medium">
            {isWaitingAuth ? t('settings_account_waiting_auth') : t('settings_account_sign_in')}
          </span>
        </button>

      ) : (
        <div className="flex flex-col">

          <div className="flex items-center gap-4 py-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
              {userData?.avatar_url ? (
                <img src={userData.avatar_url} alt={userData.full_name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-gray-500">
                  {getInitials(userData?.full_name)}
                </span>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex mb-1">
                <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-[1px] text-[8px] font-semibold tracking-wider text-gray-500 ring-1 ring-inset ring-gray-500/10">
                  {userData?.active_plan_name || t('settings_account_free_plan')}
                </span>
              </div>
              <span className="text-base font-bold text-gray-900 leading-none">
                {userData?.full_name}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 pb-3 pt-1 w-full text-sm text-gray-700 hover:text-gray-900 transition-colors group cursor-pointer focus:outline-none text-left"
          >
            <LuLogOut size={16} className="text-gray-700 group-hover:text-gray-900 transition-colors" />
            <span className="font-medium">{t('settings_account_logout')}</span>
          </button>

        </div>
      )}

    </SettingsSection>
  );
}