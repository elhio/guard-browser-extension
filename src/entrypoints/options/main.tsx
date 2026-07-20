import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import '@/assets/pages.css';
import { createQueryClient } from '@/lib/queryClient';
import OptionsApp from './OptionsApp';

const queryClient = createQueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <OptionsApp />
    </QueryClientProvider>
  </React.StrictMode>
);