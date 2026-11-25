import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { AppProviders } from '@/app/providers/AppProviders';
import { createAppRouter } from '@/app/router/routes';
import '@/styles/index.css';

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
