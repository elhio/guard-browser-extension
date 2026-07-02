import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';

export function ActionSettingsCard() {
  const [detectionAction, setDetectionAction] = useState('mark');

  useEffect(() => {
    browser.storage.local.get(['detectionAction']).then((res) => {
      if (res.detectionAction) setDetectionAction(res.detectionAction);
    });
  }, []);

  const handleSelectAction = async (action: string) => {
    setDetectionAction(action);
    await browser.storage.local.set({ detectionAction: action });
  };

  const checkboxClasses = "h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-teal-600 accent-teal-500 focus:outline-none transition-all";

  return (
    <SettingsSection title={t('settings_action_title')}>

      {/* Mark Row */}
      <SettingsRow
        label={t('settings_action_mark_label')}
        description={t('settings_action_mark_desc')}
        value={
          <input
            type="checkbox"
            checked={detectionAction === 'mark'}
            onChange={() => handleSelectAction('mark')}
            className={checkboxClasses}
            aria-label={t('settings_action_mark_aria')}
          />
        }
      />

      {/* Blur Row */}
      <SettingsRow
        label={t('settings_action_blur_label')}
        description={t('settings_action_blur_desc')}
        value={
          <input
            type="checkbox"
            checked={detectionAction === 'blur'}
            onChange={() => handleSelectAction('blur')}
            className={checkboxClasses}
            aria-label={t('settings_action_blur_aria')}
          />
        }
      />

      {/* Hide Row */}
      <SettingsRow
        label={t('settings_action_hide_label')}
        description={t('settings_action_hide_desc')}
        value={
          <input
            type="checkbox"
            checked={detectionAction === 'hide'}
            onChange={() => handleSelectAction('hide')}
            className={checkboxClasses}
            aria-label={t('settings_action_hide_aria')}
          />
        }
      />

    </SettingsSection>
  );
}