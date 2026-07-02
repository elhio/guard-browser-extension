import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import OnboardingWizard from '@/components/setup/OnboardingWizard';
import SettingsDashboard from './SettingsDashboard';

export default function OptionsApp() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    browser.storage.local.get('hasCompletedSetup').then((res) => {
      setIsSetupComplete(!!res.hasCompletedSetup);
    });
  }, []);

  if (isSetupComplete === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-teal-600" />
      </div>
    );
  }

  return isSetupComplete ? (
    <SettingsDashboard onReset={() => setIsSetupComplete(false)} />
  ) : (
    <OnboardingWizard onComplete={() => setIsSetupComplete(true)} />
  );
}