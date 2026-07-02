import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';

export function DetectionSettingsCard() {
  const [lensMobile, setLensMobile] = useState(false);

  useEffect(() => {
    // Load the saved Lens Mobile preference from storage
    browser.storage.local.get('lensMobile').then((res) => {
      if (res.lensMobile !== undefined) {
        setLensMobile(res.lensMobile);
      }
    });
  }, []);

  const handleToggleLensMobile = async () => {
    const newState = !lensMobile;
    setLensMobile(newState);
    await browser.storage.local.set({ lensMobile: newState });
  };

  const checkboxClasses = "h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-teal-600 accent-teal-500 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <SettingsSection title={t('settings_detection_title')}>
      <SettingsRow
        label={t('settings_detection_metadata_label')}
        description={t('settings_detection_metadata_desc')}
        value={
          <input
            type="checkbox"
            checked={true}
            disabled={true}
            className={checkboxClasses}
            aria-label={t('settings_detection_metadata_aria')}
          />
        }
      />
      <SettingsRow
        label={t('settings_detection_lens_label')}
        description={t('settings_detection_lens_desc')}
        value={
          <input
            type="checkbox"
            checked={lensMobile}
            onChange={handleToggleLensMobile}
            className={checkboxClasses}
            aria-label={t('settings_detection_lens_aria')}
          />
        }
      />

    </SettingsSection>
  );
}