import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';
import { useSetting } from '@/lib/settings';
import type { TargetsState } from '@/lib/detection';

export function TargetsSettingsCard() {
  const [targets, setTargets] = useSetting('targets');

  const handleToggle = async (key: keyof TargetsState) => {
    const activeTargetCount = Object.values(targets).filter(Boolean).length;

    // Never allow disabling the last remaining target.
    if (targets[key] && activeTargetCount === 1) {
      return;
    }

    await setTargets({ ...targets, [key]: !targets[key] });
  };

  const checkboxClasses = "h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-teal-600 accent-teal-500 focus:outline-none transition-all";

  return (
    <SettingsSection title={t('settings_targets_title')}>
      {/* AI-Generated Row */}
      <SettingsRow
        label={t('settings_targets_ai_label')}
        description={t('settings_targets_ai_desc')}
        value={
          <input
            type="checkbox"
            checked={targets.aiGenerated}
            onChange={() => handleToggle('aiGenerated')}
            className={checkboxClasses}
            aria-label={t('settings_targets_ai_aria')}
          />
        }
      />
      {/* Violent Row */}
      <SettingsRow
        label={t('settings_targets_violent_label')}
        description={t('settings_targets_violent_desc')}
        value={
          <input
            type="checkbox"
            checked={targets.violent}
            onChange={() => handleToggle('violent')}
            className={checkboxClasses}
            aria-label={t('settings_targets_violent_aria')}
          />
        }
      />
      {/* Explicit Row */}
      <SettingsRow
        label={t('settings_targets_explicit_label')}
        description={t('settings_targets_explicit_desc')}
        value={
          <input
            type="checkbox"
            checked={targets.explicit}
            onChange={() => handleToggle('explicit')}
            className={checkboxClasses}
            aria-label={t('settings_targets_explicit_aria')}
          />
        }
      />
    </SettingsSection>
  );
}