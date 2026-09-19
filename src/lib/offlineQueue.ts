// Queues a write (logging a hotel, a flight, etc.) when there's no
// connection, instead of just failing with an error, then replays it
// automatically once connectivity returns. Deliberately built as a
// generic key+args queue rather than one queue per write type, so
// extending it to more writes later is a one-line registration, not a
// new subsystem each time.
const QUEUE_KEY = 'journeys-offline-queue';

interface QueuedWrite {
  id: string;
  key: string;
  args: unknown[];
  queuedAt: number;
  label: string; // human-readable, for the "waiting to sync" UI
}

function getQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedWrite[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage unavailable -- the write already happened or will be
    // retried in-memory this session; losing the persisted queue on a
    // reload is an acceptable degradation, not a crash.
  }
  notifyListeners();
}

// A network failure from fetch() itself (offline, DNS failure, timeout)
// throws a TypeError in every browser -- a real Supabase-level error
// (bad input, RLS denial, a genuine validation problem) comes back as
// a proper error object with its own message, not a TypeError. Only
// the former should be queued for retry; the latter is a real error
// the user needs to see and fix, not silently hide and keep retrying.
function looksLikeNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message).toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
  }
  return false;
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notifyListeners() {
  listeners.forEach((l) => l());
}
export function onQueueChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueuedWrites(): QueuedWrite[] {
  return getQueue();
}

function enqueue(key: string, args: unknown[], label: string) {
  const queue = getQueue();
  queue.push({ id: crypto.randomUUID(), key, args, queuedAt: Date.now(), label });
  saveQueue(queue);
}

// Handlers must be registered (see registerOfflineWriteHandlers below,
// called once at app startup) before a queued write from a previous
// session can be replayed -- functions themselves can't be serialized
// into localStorage, only their name and arguments can.
const registry = new Map<string, (...args: unknown[]) => Promise<void>>();
export function registerWriteHandler(key: string, fn: (...args: unknown[]) => Promise<void>) {
  registry.set(key, fn);
}

// Wraps a write call: tries it immediately if the browser thinks it's
// online, queues it (without even attempting the call) if not, and
// falls back to queueing if an attempted call fails with what looks
// like a genuine network error rather than a real validation/permission
// error. Returns whether the write was queued (for offline) versus
// completed immediately, so the caller can show the right message.
export async function withOfflineFallback<A extends unknown[]>(
  key: string, label: string, fn: (...args: A) => Promise<void>, ...args: A
): Promise<{ queued: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueue(key, args, label);
    return { queued: true };
  }
  try {
    await fn(...args);
    return { queued: false };
  } catch (err) {
    if (looksLikeNetworkError(err)) {
      enqueue(key, args, label);
      return { queued: true };
    }
    throw err;
  }
}

// Replays every queued write in order, using the registered handler for
// each. A write that fails again (still offline, or a fresh error)
// stays in the queue for the next attempt rather than being dropped.
export async function processQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };
  const remaining: QueuedWrite[] = [];
  let succeeded = 0;
  let failed = 0;
  for (const item of queue) {
    const handler = registry.get(item.key);
    if (!handler) {
      remaining.push(item); // not registered yet this session -- keep it, don't lose it
      continue;
    }
    try {
      await handler(...item.args);
      succeeded++;
    } catch {
      failed++;
      remaining.push(item);
    }
  }
  saveQueue(remaining);
  return { succeeded, failed };
}

// Call once at app startup: registers the offline-capable write
// functions by name (so a queue saved in a previous session can be
// replayed) and starts auto-processing whenever the browser regains
// connectivity.
export function initOfflineQueue(handlers: Record<string, (...args: unknown[]) => Promise<void>>) {
  for (const [key, fn] of Object.entries(handlers)) registerWriteHandler(key, fn);
  window.addEventListener('online', () => { processQueue(); });
  // Also try once on startup, in case connectivity was restored while
  // the app was closed rather than while it was open to catch the
  // 'online' event.
  if (typeof navigator === 'undefined' || navigator.onLine !== false) processQueue();
}
