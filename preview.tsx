import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DesignPreview } from './components/DesignPreview';

// Standalone entry for the backend-free design preview. Mounted only by
// preview.html — the real app (index.tsx / App.tsx) is untouched.
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <DesignPreview />
  </React.StrictMode>
);
