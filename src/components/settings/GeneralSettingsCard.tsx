import { browser } from 'wxt/browser';

import SettingsSection from '@/components/ui/SettingsSection';
import SettingsRow from '@/components/ui/SettingsRow';
import { t } from '@/lib/i18n';
import { useSetting } from '@/lib/settings';

export function GeneralSettingsCard() {
  const [isActive, setIsActive] = useSetting('isActive');

  const version = `v${browser.runtime.getManifest().version}`;

  const handleToggleStatus = () => setIsActive(!isActive);

  const handleUpdateCheck = async () => {
    const installed = browser.runtime.getManifest().version;

    // Safari has no `requestUpdateCheck`; extensions update via their App Store container app. Ask the
    // iTunes Lookup API for the latest published version and hand the user off to the store if newer.
    // Dynamically imported so the lookup code folds out of the Chrome/Firefox bundles.
    if (import.meta.env.SAFARI) {
      try {
        const { fetchAppStoreInfo, isNewerVersion } = await import('@/lib/update/appStore');
        const info = await fetchAppStoreInfo();
        if (!info) {
          alert(t('settings_general_update_store_error'));
        } else if (isNewerVersion(info.version, installed)) {
          alert(`${t('settings_general_update_available')} v${info.version}. ${t('settings_general_update_open_store')}`);
          if (info.url) browser.tabs.create({ url: info.url });
        } else {
          alert(t('settings_general_update_latest'));
        }
      } catch (err) {
        console.warn('App Store update check failed:', err);
        alert(t('settings_general_update_store_error'));
      }
      return;
    }

    try {
      const result = await browser.runtime.requestUpdateCheck();
      if (result.status === 'update_available') {
        alert(`${t('settings_general_update_available')} ${result.version}. ${t('settings_general_update_downloading')}`);
        browser.runtime.reload();
      } else if (result.status === 'no_update') {
        alert(t('settings_general_update_latest'));
      } else {
        alert(t('settings_general_update_throttled'));
      }
    } catch (err) {
      console.warn('Update check failed:', err);
      alert(t('settings_general_update_error'));
    }
  };

  return (
    <SettingsSection title={t('settings_general_title')}>
      {/* Status Row */}
      <SettingsRow
        label={t('settings_general_status')}
        value={
          <div className="flex flex-row-reverse justify-end sm:flex-row sm:justify-start items-center gap-3">
            <button
              onClick={handleToggleStatus}
              data-testid="settings-status-toggle"
              className={`px-2 py-0.5 text-xs font-semibold rounded-md border shadow-sm transition-colors focus:outline-none ${
                isActive
                  ? 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  : 'bg-teal-600 text-white border-teal-700 hover:bg-teal-700'
              }`}
            >
              {isActive ? t('settings_general_deactivate') : t('settings_general_activate')}
            </button>
            <span>
              {isActive ? t('settings_general_active') : t('settings_general_inactive')}
            </span>
          </div>
        }
        stackOnMobile={true}
      />
      {/* Version Row */}
      <SettingsRow
        label={t('settings_general_version')}
        value={
          <div className="flex flex-row-reverse justify-end sm:flex-row sm:justify-start items-center gap-3">
            <button
              onClick={handleUpdateCheck}
              className="px-2 py-0.5 text-xs font-semibold rounded-md border shadow-sm transition-colors focus:outline-none bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            >
              {t('settings_general_update')}
            </button>
            <span>
              {version}
            </span>
          </div>
        }
        stackOnMobile={true}
      />
    </SettingsSection>
  );
}