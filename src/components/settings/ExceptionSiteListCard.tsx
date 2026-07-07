import { useEffect, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';

import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';
import { settings } from '@/lib/settings/store';

export function ExceptionSiteListCard() {
  const [sites, setSites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    settings.getValue().then((currentSettings) => {
      setSites(currentSettings.exceptionSites || []);
      setIsLoading(false);
    });

    const unwatch = settings.watch((newSettings) => {
      if (newSettings && newSettings.exceptionSites) {
        setSites(newSettings.exceptionSites);
      }
    });

    return () => unwatch();
  }, []);

  const handleRemove = async (siteToRemove: string) => {
    const updatedSites = sites.filter((site) => site !== siteToRemove);

    setSites(updatedSites);

    const currentSettings = await settings.getValue();
    await settings.setValue({
      ...currentSettings,
      exceptionSites: updatedSites,
    });
  };

  return (
    <SettingsSection title={t('settings_exception_title')}>
      {isLoading ? (
        <div className="flex flex-col animate-pulse">
          {[1, 2].map((i) => (
            <SettingsRow
              key={`skeleton-${i}`}
              label={<div className="h-4 w-48 bg-gray-200 rounded" />}
              value={<div className="h-5 w-5 bg-gray-200 rounded" />}
            />
          ))}
        </div>
      ) : sites.length === 0 ? (
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