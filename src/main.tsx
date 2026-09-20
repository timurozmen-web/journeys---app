import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';
import { initOfflineQueue } from './lib/offlineQueue';
import { addHotel, addFlight, addTrip, updateTrip, addReview } from './lib/queries';

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

// Registers the writes that can currently be queued while offline (see
// src/lib/offlineQueue.ts) and starts auto-retrying them once
// connectivity returns. Covers logging a hotel/flight, creating or
// editing a trip (addTrip accepts a pre-generated id specifically so a
// queued hotel or trip can reference each other correctly before either
// has actually synced), and submitting a review -- the actions someone
// is realistically doing with patchy signal, not every write in the app.
initOfflineQueue({
  addHotel: addHotel as (...args: unknown[]) => Promise<void>,
  addFlight: addFlight as (...args: unknown[]) => Promise<void>,
  addTrip: (async (input: Parameters<typeof addTrip>[0], id?: string) => { await addTrip(input, id); }) as (...args: unknown[]) => Promise<void>,
  updateTrip: updateTrip as (...args: unknown[]) => Promise<void>,
  addReview: addReview as (...args: unknown[]) => Promise<void>,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
