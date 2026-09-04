// Destination photo lookup for the current-trip hero. Uses Wikipedia's
// public REST/action API, which is free, keyless, and CORS-enabled for
// anonymous requests (origin=*) -- no secret to manage, works client-side.
//
// The rule: always query the most specific location first (city + country),
// then city alone, then the trip's own title, then country alone. This is
// what actually fixes "just Portugal" turning into "Faro, Algarve" -- a
// city-level query resolves to that city's own Wikipedia page/photo rather
// than a generic country photo.
const cache = new Map<string, string | null>();

async function searchPageImage(query: string): Promise<string | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&generator=search' +
    `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&gsrnamespace=0` +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=1600&format=json&origin=*';
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0] as { thumbnail?: { source?: string } } | undefined;
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function fetchDestinationPhoto(candidateQueries: string[]): Promise<string | null> {
  const seen = new Set<string>();
  for (const raw of candidateQueries) {
    const q = raw?.trim();
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    if (cache.has(q)) {
      const hit = cache.get(q)!;
      if (hit) return hit;
      continue;
    }
    const photo = await searchPageImage(q);
    cache.set(q, photo);
    if (photo) return photo;
  }
  return null;
}

// Builds the fallback chain for a trip: most specific city/region first,
// down to the trip's own title and the country alone.
export function destinationQueries(tripTitle: string, hotel: { city: string | null; country: string } | null): string[] {
  const out: string[] = [];
  if (hotel?.city) out.push(`${hotel.city}, ${hotel.country}`);
  if (hotel?.city) out.push(hotel.city);
  if (tripTitle) out.push(tripTitle);
  if (hotel?.country) out.push(hotel.country);
  return out;
}
