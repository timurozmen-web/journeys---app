// A thin, safe wrapper around localStorage used to remember the last
// real data each screen fetched -- so reopening the app can show that
// immediately (instead of a blank/mock flash while the network call is
// still in flight) and keep showing it if the network call fails
// outright (genuinely offline, not just slow), rather than silently
// swapping in sample data with no way to tell the difference.
//
// Deliberately NOT used for anything the user types or logs (hotels,
// flights, reviews being added) -- those still go straight to Supabase
// as writes always have. This is a read-cache for what's already been
// fetched, not an offline-write queue; that's a materially bigger
// feature (conflict resolution, a sync queue, retry logic) and a
// separate piece of work from "show what I already had while
// reconnecting."
const PREFIX = 'journeys-cache:';
const VERSION = 1; // bump to invalidate all cached entries after a real schema/shape change

interface CacheEnvelope<T> {
  v: number;
  cachedAt: number;
  data: T;
}

export function getCached<T>(key: string): { data: T; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    if (envelope.v !== VERSION) return null;
    return { data: envelope.data, cachedAt: envelope.cachedAt };
  } catch {
    // Private browsing mode, storage disabled, or corrupted JSON --
    // treat exactly like "nothing cached yet" rather than crashing.
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  try {
    const envelope: CacheEnvelope<T> = { v: VERSION, cachedAt: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage disabled -- losing the cache write is
    // fine, the app still works from the network, it just won't have
    // an instant/offline fallback for this one key.
  }
}

export function clearAllCached(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // Nothing to do if storage isn't available.
  }
}
