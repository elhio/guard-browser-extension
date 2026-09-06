import { getAppLocale } from '@/lib/i18n';

/** The configured website origin, without a trailing slash. */
function websiteBase(): string {
  return (import.meta.env.VITE_WEBSITE_URL || '').replace(/\/+$/, '');
}

/**
 * The query every website link from the extension carries.
 *
 * `source` marks the visit as coming from an extension; `browser` says which build. The website uses
 * `browser` to suppress plan selection and payment for Safari, whose build ships through the App
 * Store: review guideline 3.1.1(a) forbids the app from directing customers to a purchasing
 * mechanism other than in-app purchase. Chrome and Firefox keep the full flow.
 */
function extensionQuery(): URLSearchParams {
  return new URLSearchParams({
    source: 'extension',
    browser: import.meta.env.BROWSER,
  });
}

/** Auth entry points on the Elhio website that the extension can send a user to. */
export type AuthPage = 'login' | 'signup';

/**
 * Builds a locale-aware auth URL on the Elhio website.
 *
 * Every caller must go through here. The URL used to be assembled by hand at four call sites, and
 * one of them (the in-page overlay's "Sign in to verify") drifted to the marketing site root
 * instead — which reads as a purchase call-to-action, because that page carries the pricing table.
 */
export function websiteAuthUrl(page: AuthPage): string {
  return `${websiteBase()}/${getAppLocale()}/${page}?${extensionQuery()}`;
}

/**
 * Builds a URL into the website's account area.
 *
 * Unlike the auth pages this route carries no locale segment, so it deliberately does not go through
 * `websiteAuthUrl` — prefixing it would produce `/en/settings/account`, which does not exist.
 *
 * `deleteAccount` opens the account page with its deletion confirmation modal already showing.
 * App Review guideline 5.1.1(v) requires account deletion to be initiated from inside the app, and
 * Apple's guidance asks for a link that lands directly on the page completing it rather than on a
 * hub the user has to search — hence the parameter rather than a plain link to the account page.
 */
export function websiteAccountUrl({ deleteAccount = false } = {}): string {
  const query = extensionQuery();
  if (deleteAccount) query.set('delete', 'true');

  return `${websiteBase()}/settings/account?${query}`;
}

/**
 * Builds a URL to the website's public profile of one user.
 *
 * The website keys this route on the user's handle rather than their id, and encodes it because a
 * handle is user-supplied text. Like the dashboard it carries no locale segment.
 */
export function websiteProfileUrl(name: string): string {
  return `${websiteBase()}/users/${encodeURIComponent(name)}?${extensionQuery()}`;
}

/**
 * Builds a URL to the website's dashboard. Like the account area this route carries no locale segment.
 */
export function websiteDashboardUrl(): string {
  return `${websiteBase()}/dashboard?${extensionQuery()}`;
}

/**
 * Builds a URL into the website's billing settings.
 *
 * `bundle` opens the page with its token bundle card selected, matching the `card` search parameter
 * the billing route validates. It is what the account card's "Buy tokens" action points at; the
 * "Upgrade your plan" variant links to the same page without it.
 */
export function websiteBillingUrl({ bundle = false } = {}): string {
  const query = extensionQuery();
  if (bundle) query.set('card', 'bundle');

  return `${websiteBase()}/settings/billing?${query}`;
}
