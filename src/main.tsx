import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';

// autoUpdate + skipWaiting/clientsClaim (see vite.config.ts) handle most
// of this already, but a PWA opened from the home screen icon doesn't
// always trigger the browser's own periodic update check promptly --
// explicitly re-checking every time the app comes back to the
// foreground closes that gap, so reopening the app after a new deploy
// reliably picks it up rather than depending on timing.
const updateSW = registerSW({ immediate: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateSW();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
