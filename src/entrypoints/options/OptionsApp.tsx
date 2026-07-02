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

  if (isSetupComplete === null) return <div>Loading...</div>;

  return isSetupComplete ? (
    <SettingsDashboard onReset={() => setIsSetupComplete(false)} />
  ) : (
    <OnboardingWizard onComplete={() => setIsSetupComplete(true)} />
  );
}