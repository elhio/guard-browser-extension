import { useEffect, useState } from 'react';

import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';
import { settings } from '@/lib/settings/store';

export function DetectionSettingsCard() {
  const [useDetectorLocalModel, setUseDetectorLocalModel] = useState(false);

  useEffect(() => {
    settings.getValue().then((currentSettings) => {
      if (currentSettings.useDetectorLocalModel !== undefined) {
        setUseDetectorLocalModel(currentSettings.useDetectorLocalModel);
      }
    });

    const unwatch = settings.watch((newSettings) => {
      if (newSettings && newSettings.useDetectorLocalModel !== undefined) {
        setUseDetectorLocalModel(newSettings.useDetectorLocalModel);
      }
    });

    return () => unwatch();
  }, []);

  const handleToggleLocalModel = async () => {
    const newState = !useDetectorLocalModel;

    setUseDetectorLocalModel(newState);

    const currentSettings = await settings.getValue();
    await settings.setValue({
      ...currentSettings,
      useDetectorLocalModel: newState
    });
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
            checked={useDetectorLocalModel}
            onChange={handleToggleLocalModel}
            className={checkboxClasses}
            aria-label={t('settings_detection_lens_aria')}
          />
        }
      />
    </SettingsSection>
  );
}