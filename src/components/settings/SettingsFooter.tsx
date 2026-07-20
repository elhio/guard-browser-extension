import { getAppLocale, t } from '@/lib/i18n';

/**
 * Legal footer for the settings page: a muted tagline over Privacy / Terms / Contact links.
 *
 * Links are locale-aware and point at the marketing site, following the same
 * `${VITE_WEBSITE_URL}/${locale}/...` convention the account links use.
 */
export function SettingsFooter() {
  const base = import.meta.env.VITE_WEBSITE_URL || '';
  const locale = getAppLocale();

  const links: { key: 'privacy' | 'terms' | 'contact'; label: string }[] = [
    { key: 'privacy', label: t('settings_footer_privacy') },
    { key: 'terms', label: t('settings_footer_terms') },
    { key: 'contact', label: t('settings_footer_contact') },
  ];

  return (
    <footer className="mt-3 pt-3 text-center">
      <nav className="flex items-center justify-center gap-2 text-xs text-gray-500">
        {links.map(({ key, label }, index) => (
          <span key={key} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">·</span>}
            <a
              href={`${base}/${locale}/${key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gray-700"
            >
              {label}
            </a>
          </span>
        ))}
      </nav>
      <p className="mt-2 text-xs text-gray-500">{t('settings_footer_tagline')}</p>
    </footer>
  );
}
