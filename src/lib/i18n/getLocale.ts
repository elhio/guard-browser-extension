import { browser } from 'wxt/browser';

export const SUPPORTED_LOCALES = ['en', 'de'] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Gets the current browser UI language and maps it to a supported locale.
 * Falls back to DEFAULT_LOCALE if the user's language is not supported.
 */
export function getAppLocale(): SupportedLocale {
  try {
    const browserLang = browser.i18n.getUILanguage().split('-')[0].toLowerCase();

    if (SUPPORTED_LOCALES.includes(browserLang as SupportedLocale)) {
      return browserLang as SupportedLocale;
    }

    return DEFAULT_LOCALE;
  } catch (error) {
    return DEFAULT_LOCALE;
  }
}