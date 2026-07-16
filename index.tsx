import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import { initSentry } from './services/sentry';

// Start error tracking as early as possible (no-op until VITE_SENTRY_DSN is set).
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page. Our team has been notified.</p>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);