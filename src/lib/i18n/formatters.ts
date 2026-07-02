import { getAppLocale } from './getLocale';

/**
 * Formats a date into a localized string.
 * Example (de): 31. Dez. 2024
 * Example (en): Dec 31, 2024
 */
export function formatDate(date: Date | number | string, options?: Intl.DateTimeFormatOptions): string {
  const locale = getAppLocale();
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  const dateObj = new Date(date);
  return new Intl.DateTimeFormat(locale, options || defaultOptions).format(dateObj);
}

/**
 * Formats a number with localized thousands separators and decimals.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = getAppLocale();
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Formats a number as currency.
 */
export function formatCurrency(value: number, currencyCode: string = 'EUR'): string {
  const locale = getAppLocale();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}