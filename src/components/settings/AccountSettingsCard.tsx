import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import {
  LuLayoutGrid,
  LuLogOut,
  LuLogIn,
  LuSettings,
  LuTrash2,
} from 'react-icons/lu';
import { useQuery } from '@tanstack/react-query';

import SettingsSection from '@/components/ui/SettingsSection';
import { formatNumber, t } from '@/lib/i18n';
import {
  websiteAccountUrl,
  websiteAuthUrl,
  websiteBillingUrl,
  websiteDashboardUrl,
  websiteProfileUrl,
} from '@/lib/website/urls';
import { settings, clearSession, isTokenExpired } from '@/lib/settings';
import { fetchSubscription, fetchUserProfile, fetchUserUsage, isSessionRejected } from '@/lib/api';

/**
 * One row in the menu block: a link when `href` is given, a button otherwise. Both render the same
 * way, which is what keeps the four rows visually identical despite two of them leaving the page.
 *
 * @property icon - The leading glyph, sized and coloured by the caller so every row matches
 * @property label - The row's text
 * @property href - Where the row leads. Given one it renders as an external link, opening in a new
 *   tab; without one it renders as a button and `onClick` is what it does
 * @property title - Native tooltip text, used where a row needs to explain what it will open
 * @property onClick - What a button row does when pressed. Ignored when `href` is set
 */
function MenuRow({
  icon,
  label,
  href,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  title?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon}
      <span className="font-medium">{label}</span>
    </>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="flex items-center gap-3 py-2 w-full text-sm text-gray-700 hover:text-gray-900 transition-colors group cursor-pointer focus:outline-none text-left"
    >
      {content}
    </a>
  ) : (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-3 py-2 w-full text-sm text-gray-700 hover:text-gray-900 transition-colors group cursor-pointer focus:outline-none text-left"
    >
      {content}
    </button>
  );
}

/**
 * The avatar, name and plan line, linking to the user's public profile when there is one to link to.
 *
 * A profile needs the handle from the API, so a failed profile query leaves the row as plain text
 * rather than as a link to `/users/undefined`.
 *
 * @property href - The user's public profile. Omitted when the handle is unknown, which downgrades
 *   the row to plain text rather than pointing it at a profile that cannot exist
 * @property children - The avatar and the two text lines, passed in so this component decides only
 *   whether the row is a link
 */
function IdentityRow({ href, children }: { href?: string; children: ReactNode }) {
  const className = 'flex items-center gap-3 py-2 w-full text-left';

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} cursor-pointer focus:outline-none`}
    >
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

/**
 * The token count and the bar, as one target opening the billing page.
 *
 * Like the identity row it answers hover with nothing but the cursor. The call to action below it
 * stays a separate link: that one carries the bundle parameter, and it is the one control here
 *
 *
 * @property children - The token count and the progress bar, wrapped as a single click target
 */
function UsageSummary({ children }: { children: ReactNode }) {
  if (import.meta.env.SAFARI) return <>{children}</>;

  return (
    <a
      href={websiteBillingUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="block cursor-pointer focus:outline-none"
    >
      {children}
    </a>
  );
}

/**
 * The call to action under the usage bar, which is where the two purchase routes part company.
 *
 * Everywhere but Safari it stays what it always was: a link to the billing page, carrying the bundle
 * parameter so the site opens on the right card. The Safari build may not link out at all — review
 * guideline 3.1.1(a) forbids an App Store app pointing customers at another way to pay — so it opens
 * the container app instead, which is the only place StoreKit can present a payment sheet.
 *
 * When a Safari user's plan forbids bundles there is nothing honest left to offer, so nothing is
 * rendered. The other builds still show "Upgrade your plan" and link to it.
 *
 * @property label - "Buy tokens" or "Upgrade your plan", already chosen by the caller
 * @property allowBundlePurchase - Whether the plan allows buying bundles at all
 * @property onBuyInApp - Hands the session to the container app and launches it. Safari only
 */
function PurchaseCall({
  label,
  allowBundlePurchase,
  onBuyInApp,
}: {
  label: string;
  allowBundlePurchase: boolean;
  onBuyInApp: () => void;
}) {
  const className =
    'mt-2 inline-block text-xs font-medium text-gray-900 hover:underline underline-offset-2 focus:outline-none';

  if (import.meta.env.SAFARI) {
    if (!allowBundlePurchase) return null;

    return (
      <button
        type="button"
        onClick={onBuyInApp}
        data-testid="account-buy-tokens"
        className={`${className} cursor-pointer`}
      >
        {label}
      </button>
    );
  }

  return (
    <a
      href={websiteBillingUrl({ bundle: allowBundlePurchase })}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="account-buy-tokens"
      className={className}
    >
      {label}
    </a>
  );
}

/**
 * The account section of the settings page, mirroring the website's user menu.
 *
 * Renders one of four states, decided by whether there is a usable token and what the profile call
 * answered: the loading skeleton, the sign-in button, the signed-in menu, or a notice that the
 * account could not be read. See `isSessionOver` for what separates the last two, which is the
 * difference between a session that has ended and a server that cannot be reached.
 */
export function AccountSettingsCard() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);
  // Safari only: set when the container app has been sent to, so returning here refreshes the balance
  const [isBuyingInApp, setIsBuyingInApp] = useState(false);

  const loginUrl = websiteAuthUrl('login');

  /**
   * Falls back to the user's initials when there is no avatar to show.
   *
   * @param name - The user's full name, absent until the profile arrives
   * @returns Up to two uppercase letters, or '?' when there is no name to take them from
   */
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  useEffect(() => {
    let isMounted = true;

    settings.getValue().then((res) => {
      if (!isMounted) return;
      setToken(res.token);
    });

    const unwatch = settings.watch((newSettings) => {
      if (!newSettings || !isMounted) return;
      setToken(newSettings.token);
      // The background stores the token (see PATH 3.5); arriving here is what ends the wait.
      if (newSettings.token) setIsWaitingAuth(false);
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, []);

  // A token past its own expiry buys nothing: every call it is attached to comes back refused
  const isTokenUsable = !!token && !isTokenExpired(token);

  // Storage still holds the dead token, and the rest of the extension reads storage. Clearing it
  // keeps the in-page menu and the verify path agreeing with what this card already shows
  useEffect(() => {
    if (token && isTokenExpired(token)) void clearSession();
  }, [token]);

  const {
    data: userData,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['userProfile', token],
    queryFn: () => fetchUserProfile(token!),
    enabled: isTokenUsable,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: usage,
    isLoading: isUsageLoading,
    isError: isUsageError,
    refetch: refetchUsage,
  } = useQuery({
    queryKey: ['userUsage', token],
    queryFn: () => fetchUserUsage(token!),
    enabled: isTokenUsable,
    staleTime: 1000 * 60 * 5,
  });

  const { data: subscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['subscription', token],
    queryFn: () => fetchSubscription(token!),
    enabled: isTokenUsable,
    staleTime: 1000 * 60 * 5,
  });

  const isSessionOver = isUserError && isSessionRejected(userError);
  const isAccountUnavailable = isUserError && !isSessionOver && !userData;
  const isAuthenticated = isTokenUsable && !isSessionOver;
  const isLoading = token === undefined || (isTokenUsable && isUserLoading);

  const handleRetry = () => {
    void refetchUser();
    void refetchUsage();
    void refetchSubscription();
  };

  const tokensUsed = usage?.consumed_tokens ?? 0;
  const tokensLimit = usage
    ? usage.base_tokens + usage.purchased_tokens + usage.rewarded_tokens
    : 0;
  const usedPercent = tokensLimit > 0 ? Math.min(100, (tokensUsed / tokensLimit) * 100) : 0;

  const allowBundlePurchase = subscription?.allow_bundle_purchases ?? false;

  const ctaLabel = allowBundlePurchase
    ? t('settings_account_buy_tokens')
    : t('settings_account_upgrade_plan');

  const isRestricted = userData?.is_restricted ?? false;

  const profileUrl = userData?.name ? websiteProfileUrl(userData.name) : undefined;

  const handleLoginClick = async () => {
    setIsWaitingAuth(true);
    await browser.tabs.create({ url: loginUrl, active: true });
    setTimeout(() => setIsWaitingAuth(false), 10000);
  };

  // Signs out of the extension only — the website session is deliberately left alone. An extension
  // yanking the user out of a site they may have open in another tab is the surprising behaviour;
  // the sync runs the other way (see `clearSession`'s callers).
  const handleLogout = () => clearSession();

  // Safari only. The purchase itself belongs to the container app: StoreKit will not present a
  // payment sheet from the extension's native handler, which has no window to anchor one to. So the
  // session is handed over first and the app is launched second — awaiting is what puts them in that
  // order. Navigating to the app's scheme hands off without unloading this page.
  //
  // Dynamically imported inside the build guard so none of it reaches the Chrome or Firefox bundles,
  // where there is no app to hand anything to.
  const handleBuyTokens = async () => {
    if (!import.meta.env.SAFARI) return;

    setIsBuyingInApp(true);

    const [{ requestStoreHandover }, { APP_STORE_URL }] = await Promise.all([
      import('@/lib/messaging/storeHandover'),
      import('@/lib/native/nativeApplication'),
    ]);

    await requestStoreHandover();
    window.location.href = APP_STORE_URL;
  };

  // A purchase happens outside this page, so nothing here would otherwise notice it. The queries opt
  // out of refetching on focus (see `createQueryClient`), which is right for every other case and
  // wrong for this one, so the balance is refreshed by hand on the way back from the app.
  useEffect(() => {
    if (!import.meta.env.SAFARI || !isBuyingInApp) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      setIsBuyingInApp(false);
      void refetchUser();
      void refetchUsage();
      void refetchSubscription();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isBuyingInApp, refetchUser, refetchUsage, refetchSubscription]);

  return (
    <SettingsSection title={t('settings_account_title')}>

      {isLoading ? (
        <div className="flex flex-col animate-pulse py-2">
          <div className="flex items-center gap-3 mb-4 w-full max-w-[240px]">
            <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-px w-full bg-gray-200 mb-4" />
          <div className="flex flex-col gap-2 mb-4 w-full max-w-[240px]">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-1.5 w-full bg-gray-200 rounded-full" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
          <div className="h-px w-full bg-gray-200 mb-4" />
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        </div>

      ) : !isAuthenticated ? (
        <button
          onClick={handleLoginClick}
          disabled={isWaitingAuth}
          data-testid="account-sign-in"
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

      ) : isAccountUnavailable ? (
        <div className="flex flex-col" data-testid="account-unavailable">
          <p className="py-2 text-sm text-gray-500">{t('settings_account_unavailable')}</p>
          <button
            type="button"
            onClick={handleRetry}
            data-testid="account-retry"
            className="self-start text-xs font-medium text-gray-900 hover:underline underline-offset-2 focus:outline-none cursor-pointer"
          >
            {t('settings_account_retry')}
          </button>

          <div className="h-px w-full bg-gray-200 mt-3" />

          <div className="py-1 w-full max-w-[240px]">
            <MenuRow
              icon={<LuLayoutGrid size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
              label={t('settings_account_dashboard')}
              href={websiteDashboardUrl()}
            />
            <MenuRow
              icon={<LuSettings size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
              label={t('settings_account_settings')}
              href={websiteAccountUrl()}
            />
            <MenuRow
              icon={<LuLogOut size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
              label={t('settings_account_logout')}
              onClick={handleLogout}
            />
          </div>
        </div>

      ) : (
        <div className="flex flex-col">
          <IdentityRow href={profileUrl}>
            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
              {userData?.avatar_url ? (
                <img src={userData.avatar_url} alt={userData.full_name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-gray-500">
                  {getInitials(userData?.full_name)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                data-testid="account-identity-name"
                className="truncate text-sm font-semibold text-gray-900"
              >
                {userData?.full_name || t('settings_account_fallback_name')}
              </p>
              <p className="truncate text-xs text-gray-500">
                {userData?.active_plan_name || t('settings_account_default_plan')}
              </p>
            </div>
          </IdentityRow>
          {!isUsageError && (
            <>
              <div className="h-px w-full bg-gray-200" />

              <div className="py-3 w-full max-w-[240px]">
                {isUsageLoading ? (
                  <div className="flex flex-col gap-2 animate-pulse">
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                    <div className="h-1.5 w-full bg-gray-200 rounded-full" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                ) : (
                  <>
                    <UsageSummary>
                      <p className="mb-2 text-xs font-medium text-gray-900">
                        {t('settings_account_tokens_used', [
                          formatNumber(tokensUsed),
                          formatNumber(tokensLimit),
                        ])}
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-all"
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                    </UsageSummary>
                    {isRestricted ? (
                      <span
                        aria-disabled="true"
                        className="mt-2 inline-block text-xs font-medium text-gray-500 cursor-not-allowed"
                      >
                        {ctaLabel}
                      </span>
                    ) : (
                      <PurchaseCall
                        label={ctaLabel}
                        allowBundlePurchase={allowBundlePurchase}
                        onBuyInApp={() => void handleBuyTokens()}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <div className="h-px w-full bg-gray-200" />

          <div className="py-1 w-full max-w-[240px]">
            <MenuRow
              icon={<LuLayoutGrid size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
              label={t('settings_account_dashboard')}
              href={websiteDashboardUrl()}
            />
            <MenuRow
              icon={<LuSettings size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
              label={t('settings_account_settings')}
              href={websiteAccountUrl()}
            />
            {/* Safari only. Apple's review guideline 5.1.1(v) requires an app that creates accounts to
                let users start deleting one from inside it, so the Safari build has to carry this row. */}
            {import.meta.env.SAFARI && (
              <MenuRow
                icon={<LuTrash2 size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
                label={t('settings_account_delete')}
                href={websiteAccountUrl({ deleteAccount: true })}
                title={t('settings_account_delete_title')}
              />
            )}
            <MenuRow
              icon={<LuLogOut size={18} className="text-gray-700 group-hover:text-gray-900 transition-colors shrink-0" />}
              label={t('settings_account_logout')}
              onClick={handleLogout}
            />
          </div>

        </div>
      )}

    </SettingsSection>
  );
}
