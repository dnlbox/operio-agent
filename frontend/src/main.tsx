import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/App';

// 1. Polyfill feature-detection for Invoker Commands
if (!('commandForElement' in HTMLButtonElement.prototype)) {
  import('invokers-polyfill')
    .then(() => console.log('Invoker Commands polyfill loaded.'))
    .catch((err) => console.error('Failed to load Invoker polyfill:', err));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
