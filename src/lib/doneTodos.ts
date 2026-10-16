// To-dos ticked off on Today that the data can't tell are done (a
// promotion registered on the programme's own site). Kept on this device;
// anything the data can tell (a flight added, a stay rated) clears itself.

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
