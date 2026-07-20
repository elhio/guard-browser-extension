import { t } from '@/lib/i18n';
import { GeneralSettingsCard } from '@/components/settings/GeneralSettingsCard';
import { TasksSettingsCard } from '@/components/settings/TasksSettingsCard';
import { ActionSettingsCard } from '@/components/settings/ActionSettingsCard';
import { DetectionSettingsCard } from '@/components/settings/DetectionSettingsCard';
import { VerificationSettingsCard } from '@/components/settings/VerificationSettingsCard';
import { AccountSettingsCard } from '@/components/settings/AccountSettingsCard';
import { ExceptionSiteListCard } from '@/components/settings/ExceptionSiteListCard';
import { SettingsFooter } from '@/components/settings/SettingsFooter';

export default function SettingsDashboard() {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10 font-sans">
      {/* Header Section */}
      <header className="mb-8 flex justify-between gap-4 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            {t('settings_dashboard_title')}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('settings_dashboard_description')}
          </p>
        </div>
        <div className="shrink-0 py-1">
          <img
            src="/icons/128.png"
            alt={t('settings_dashboard_logo_alt')}
            className="h-full max-h-12 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main Settings Content */}
      <main className="flex flex-col gap-6">
        <GeneralSettingsCard />
        <TasksSettingsCard />
        <ActionSettingsCard />
        <DetectionSettingsCard />
        <VerificationSettingsCard />
        <AccountSettingsCard />
        <ExceptionSiteListCard />
      </main>

      <SettingsFooter />
    </div>
  );
}