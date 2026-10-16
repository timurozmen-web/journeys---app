// Things deleted this session, so a page for one reached by Back (or an
// old link) moves on to its list instead of showing "not found". Kept
// apart from "not loaded yet": a trip just created isn't in the data for
// a moment either, and must not be sent away.

const KEY = 'journeys-deleted';
const memory = new Set<string>();

function read(): Set<string> {
  try {
    return new Set([...memory, ...(JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[])]);
  } catch {
    return memory;
  }
}

export function markDeleted(kind: 'trip' | 'programme', id: string): void {
  memory.add(`${kind}:${id}`);
  try { sessionStorage.setItem(KEY, JSON.stringify([...read()])); } catch { /* memory still has it */ }
}

export function wasDeleted(kind: 'trip' | 'programme', id: string): boolean {
  return read().has(`${kind}:${id}`);
}
