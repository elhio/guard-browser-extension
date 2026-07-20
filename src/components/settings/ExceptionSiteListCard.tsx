import { LuTrash2 } from 'react-icons/lu';

import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';
import { useSetting } from '@/lib/settings';

export function ExceptionSiteListCard() {
  const [sites, setSites] = useSetting('exceptionSites');

  const handleRemove = (siteToRemove: string) =>
    setSites(sites.filter((site) => site !== siteToRemove));

  return (
    <SettingsSection title={t('settings_exception_title')}>
      {sites.length === 0 ? (
        <p className="text-sm text-gray-500 py-3">
          {t('settings_exception_empty')}
        </p>
      ) : (
        <div className="flex flex-col">
          {sites.map((site) => (
            <SettingsRow
              key={site}
              label={site}
              value={
                <button
                  onClick={() => handleRemove(site)}
                  className="flex items-center justify-center p-1.5 text-gray-700 hover:text-gray-900 rounded-md transition-all cursor-pointer focus:outline-none -mr-1.5"
                  aria-label={`${t('settings_exception_remove')} ${site}`}
                  title={`${t('settings_exception_remove')} ${site}`}
                >
                  <LuTrash2 size={16} />
                </button>
              }
            />
          ))}
        </div>
      )}
    </SettingsSection>
  );
}