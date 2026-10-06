// One signal that saved data changed, so every screen and badge refreshes
// at once. Bug this fixes: deleting a stay updated the trip but other
// screens (Profile's to-rate list, the badges, wallet totals) kept the old
// figures until you navigated away and back.
export const DATA_CHANGED = 'journeys:data-changed';

export function notifyDataChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DATA_CHANGED));
}
