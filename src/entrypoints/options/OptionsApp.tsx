import { useEffect, useState } from 'react';

import OnboardingWizard from '@/components/setup/OnboardingWizard';
import SettingsDashboard from './SettingsDashboard';
import { settings } from '@/lib/settings/store';

export default function OptionsApp() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    settings.getValue().then((currentSettings) => {
      setIsSetupComplete(currentSettings.hasCompletedSetup);
    });

    const unwatch = settings.watch((newSettings) => {
      if (newSettings) setIsSetupComplete(newSettings.hasCompletedSetup);
    });

    return () => unwatch();
  }, []);

  if (isSetupComplete === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-teal-600" />
      </div>
    );
  }

  return isSetupComplete ? (
    <SettingsDashboard/>
  ) : (
    <OnboardingWizard onComplete={() => setIsSetupComplete(true)} />
  );
}