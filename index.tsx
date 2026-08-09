import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import { initSentry } from './services/sentry';

// Theme selection (build-time): VITE_THEME=brand → live brand palette (blue/dark, Inter);
// anything else → the green editorial theme (default). Drives the CSS token overrides
// in index.css via the root [data-theme] attribute. Same UI either way.
const THEME = ((import.meta.env as Record<string, string | undefined>).VITE_THEME === 'brand')
  ? 'brand'
  : 'green';
document.documentElement.setAttribute('data-theme', THEME);
document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute('content', THEME === 'brand' ? '#04080f' : '#1B221D');

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