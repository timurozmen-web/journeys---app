import { useSyncExternalStore } from 'react';

// The app has two sections sharing one set of data: Travel (trips, the
// Now timeline and the Then scrapbook, on the paper theme) and Loyalty
// (balances, status, cards, on the darker technical theme). Each screen
// belongs to one of them; shared screens (forms, settings) take the
// section you were last in. The choice is kept per device.

export type AppMode = 'travel' | 'loyalty';

export const MODE_HOME: Record<AppMode, string> = { travel: '/now', loyalty: '/loyalty' };

const TRAVEL_ROUTES = ['/now', '/then', '/trips', '/profile', '/action/plan', '/log-trip', '/review-trip'];
const LOYALTY_ROUTES = ['/loyalty', '/wallet', '/action/discover', '/action/credit', '/bank-sync', '/add-card', '/log-loyalty-programme', '/scan-promotion'];

const starts = (path: string, route: string) => path === route || path.startsWith(`${route}/`);

/** Which section a route belongs to; shared routes keep the current one. */
export function modeForPath(path: string, current: AppMode): AppMode {
  if (TRAVEL_ROUTES.some((r) => starts(path, r))) return 'travel';
  if (LOYALTY_ROUTES.some((r) => starts(path, r))) return 'loyalty';
  return current;
}

const KEY = 'journeys-mode';
const EVENT = 'journeys-mode-change';

export function readMode(): AppMode {
  try {
    return localStorage.getItem(KEY) === 'loyalty' ? 'loyalty' : 'travel';
  } catch {
    return 'travel';
  }
}

export function writeMode(mode: AppMode): void {
  if (mode === readMode()) return;
  try { localStorage.setItem(KEY, mode); } catch { /* private mode: the section still switches for this session */ }
  memory = mode;
  window.dispatchEvent(new Event(EVENT));
}

// Kept in memory too, for browsers that refuse localStorage.
let memory: AppMode | null = null;
const snapshot = () => memory ?? readMode();
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export function useAppMode(): AppMode {
  return useSyncExternalStore(subscribe, snapshot, () => 'travel');
}
