import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { QueryClientProvider } from '@tanstack/react-query';

import '@/assets/pages.css';
import { createQueryClient } from '@/lib/queryClient';
import OnboardingWizard from '@/components/setup/OnboardingWizard';
import { OpenInApp } from '@/components/app/OpenInApp';
import { APP_SETUP_URL } from '@/lib/native/nativeApplication';

const queryClient = createQueryClient();

const wizard = (
  <OnboardingWizard
    onComplete={async () => {
      await browser.runtime.openOptionsPage();

      const currentTab = await browser.tabs.getCurrent();
      if (currentTab?.id) {
        await browser.tabs.remove(currentTab.id);
      } else {
        window.close();
      }
    }}
  />
);

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        {import.meta.env.SAFARI ? (
          // On Safari, setup happens in the Elhio app.
          <OpenInApp url={APP_SETUP_URL} page="setup">
            {wizard}
          </OpenInApp>
        ) : (
          wizard
        )}
      </QueryClientProvider>
    </React.StrictMode>
  );
}