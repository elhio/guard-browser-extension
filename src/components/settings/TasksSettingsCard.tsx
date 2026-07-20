import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';
import { useSetting } from '@/lib/settings';
import type { TasksState } from '@/lib/detection';

export function TasksSettingsCard() {
  const [tasks, setTasks] = useSetting('tasks');

  const handleToggle = async (key: keyof TasksState) => {
    const activeTaskCount = Object.values(tasks).filter(Boolean).length;

    // Never allow disabling the last remaining task.
    if (tasks[key] && activeTaskCount === 1) {
      return;
    }

    await setTasks({ ...tasks, [key]: !tasks[key] });
  };

  const checkboxClasses = "h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-teal-600 accent-teal-500 focus:outline-none transition-all";

  return (
    <SettingsSection title={t('settings_tasks_title')}>
      {/* AI-Generated Row */}
      <SettingsRow
        label={t('settings_tasks_ai_label')}
        description={t('settings_tasks_ai_desc')}
        value={
          <input
            type="checkbox"
            checked={tasks.aiGenerated}
            onChange={() => handleToggle('aiGenerated')}
            className={checkboxClasses}
            aria-label={t('settings_tasks_ai_aria')}
          />
        }
      />
      {/* Violent Row */}
      <SettingsRow
        label={t('settings_tasks_violent_label')}
        description={t('settings_tasks_violent_desc')}
        value={
          <input
            type="checkbox"
            checked={tasks.violent}
            onChange={() => handleToggle('violent')}
            className={checkboxClasses}
            aria-label={t('settings_tasks_violent_aria')}
          />
        }
      />
      {/* Explicit Row */}
      <SettingsRow
        label={t('settings_tasks_explicit_label')}
        description={t('settings_tasks_explicit_desc')}
        value={
          <input
            type="checkbox"
            checked={tasks.explicit}
            onChange={() => handleToggle('explicit')}
            className={checkboxClasses}
            aria-label={t('settings_tasks_explicit_aria')}
          />
        }
      />
    </SettingsSection>
  );
}