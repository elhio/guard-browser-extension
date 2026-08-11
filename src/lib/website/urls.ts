import { getAppLocale } from '@/lib/i18n';

/** Auth entry points on the Elhio website that the extension can send a user to. */
export type AuthPage = 'login' | 'signup';

/**
 * Builds a locale-aware auth URL on the Elhio website.
 *
 * Every caller must go through here. The URL used to be assembled by hand at four call sites, and
 * one of them (the in-page overlay's "Sign in to verify") drifted to the marketing site root
 * instead — which reads as a purchase call-to-action, because that page carries the pricing table.
 *
 * `source` marks the visit as coming from an extension; `browser` says which build. The website uses
 * `browser` to suppress plan selection and payment for Safari, whose build ships through the App
 * Store: review guideline 3.1.1(a) forbids the app from directing customers to a purchasing
 * mechanism other than in-app purchase. Chrome and Firefox keep the full signup flow.
 */
export function websiteAuthUrl(page: AuthPage): string {
  const base = (import.meta.env.VITE_WEBSITE_URL || '').replace(/\/+$/, '');
  const query = new URLSearchParams({
    source: 'extension',
    browser: import.meta.env.BROWSER,
  });

  return `${base}/${getAppLocale()}/${page}?${query}`;
}
