// To-dos ticked off on Today, kept on this device so the tick shows at
// once and survives being offline. A promotion's registration is also
// stored (promotions.registered), and Today copies any tick made here
// before that column existed up to it; anything else the data can tell
// (a flight added, a stay rated) clears itself.

const KEY = 'journeys-todo-done';

export function readDoneTodos(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markTodoDone(key: string): Set<string> {
  const next = readDoneTodos();
  next.add(key);
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* private mode: done for this visit only */ }
  return next;
}

/** Promotion ids ticked as registered on this device. */
export function registeredHere(done: Set<string>): string[] {
  return [...done].filter((k) => k.startsWith('register-')).map((k) => k.slice('register-'.length));
}
