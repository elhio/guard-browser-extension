import { browser } from 'wxt/browser';

export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

/**
 * Global translation helper with full strict-typing.
 * @param key The strictly-typed message key from messages.json
 * @param substitutions Optional strings to inject into the translation variables
 */
export const t = (key: MessageKey, substitutions?: string | string[]) => {
  return browser.i18n.getMessage(key, substitutions);
};