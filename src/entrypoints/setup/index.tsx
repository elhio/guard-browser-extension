import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@/assets/tailwind.css';
import OnboardingWizard from '@/components/setup/OnboardingWizard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </React.StrictMode>
  );
}