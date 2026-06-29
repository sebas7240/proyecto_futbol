import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AdminPanel } from './AdminPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { LegalPage } from './LegalPage';
import { installClientErrorReporting } from './errorReporting';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1
    }
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

installClientErrorReporting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {window.location.pathname.startsWith('/admin') ? (
          <AdminPanel />
        ) : window.location.pathname.startsWith('/reglas') ? (
          <LegalPage page="rules" />
        ) : window.location.pathname.startsWith('/privacidad') ? (
          <LegalPage page="privacy" />
        ) : window.location.pathname.startsWith('/metodologia') ? (
          <LegalPage page="methodology" />
        ) : window.location.pathname.startsWith('/como-jugar') ? (
          <LegalPage page="howto" />
        ) : window.location.pathname.startsWith('/guias') ? (
          <LegalPage page="guides" />
        ) : window.location.pathname.startsWith('/derechos') ? (
          <LegalPage page="rights" />
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
