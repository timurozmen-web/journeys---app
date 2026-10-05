// Whether a fresh fetch should replace what a screen is showing.
// Bug this fixes: an empty result was always ignored (so a table that has
// never had rows keeps showing sample data), which also meant deleting your
// last card or programme left it on screen forever. Once real data has been
// shown, an empty result is a real answer and replaces it.
export function shouldReplace(rowCount: number, hadLiveData: boolean): boolean {
  return rowCount > 0 || hadLiveData;
}
