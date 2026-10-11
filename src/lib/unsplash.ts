// Real, licensed destination photography via the Unsplash API.
// Cached in localStorage so repeat views of the same destination don't
// burn the (fairly small) hourly rate limit -- and so multiple trip cards
// to the same country only cost one API call, not one each.
const KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;
// v2: photos are now chosen without people in them; the version moves so
// a cached photo picked the old way (Mexico's had strangers in it) is
// looked up again rather than kept for 30 days.
const CACHE_PREFIX = 'unsplash:v2:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days -- destination photos don't go stale

export interface UnsplashPhoto {
  url: string;
  photographerName: string;
  photographerUrl: string;
  downloadLocation: string;
}

function readCache(query: string): UnsplashPhoto | null | 'miss' {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + query);
    if (!raw) return 'miss';
    const { photo, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL_MS) return 'miss';
    return photo;
  } catch {
    return 'miss';
  }
}
function writeCache(query: string, photo: UnsplashPhoto | null) {
  try {
    localStorage.setItem(CACHE_PREFIX + query, JSON.stringify({ photo, savedAt: Date.now() }));
  } catch {
    // storage full or unavailable -- not worth failing over
  }
}

interface SearchResult {
  alt_description?: string | null;
  description?: string | null;
  tags?: { title?: string }[];
  urls: { regular: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

// Words in a photo's own description that mean people are in it.
const PEOPLE = /\b(man|men|woman|women|person|people|persons|boy|boys|girl|girls|child|children|kid|kids|baby|couple|crowd|tourists?|guy|guys|lady|ladies|family|friends|someone|selfie|bride|groom|portrait|swimmers?|surfers?|hikers?|travell?ers?|walking|sitting|standing)\b/i;

/**
 * The first result with no people in it, judged by Unsplash's own
 * description and tags. A destination photo is the place, not strangers:
 * Mexico's (Puerto Morelos) first result was a group of people. If every
 * result shows people, there's no photo and the drawn scene is used.
 */
export function pickPlacePhoto<T extends SearchResult>(results: T[]): T | null {
  return results.find((r) => {
    const text = [r.alt_description, r.description, ...(r.tags ?? []).map((t) => t.title)].filter(Boolean).join(' ');
    return !PEOPLE.test(text);
  }) ?? null;
}

export async function getDestinationPhoto(rawQuery: string): Promise<UnsplashPhoto | null> {
  const query = rawQuery.trim().toLowerCase();
  if (!KEY) return null; // no key configured -- caller falls back to the generated scene

  const cached = readCache(query);
  if (cached !== 'miss') return cached;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&content_filter=high&client_id=${KEY}`
    );
    if (!res.ok) {
      writeCache(query, null); // don't hammer the API for a query that's failing
      return null;
    }
    const data = await res.json();
    const first = pickPlacePhoto((data.results ?? []) as SearchResult[]);
    if (!first) {
      writeCache(query, null);
      return null;
    }
    const photo: UnsplashPhoto = {
      url: first.urls.regular,
      photographerName: first.user.name,
      photographerUrl: first.user.links.html,
      downloadLocation: first.links.download_location,
    };
    writeCache(query, photo);
    // Unsplash's API terms require pinging this when a photo is actually
    // displayed (not just browsed in a picker) -- fire-and-forget, doesn't
    // block rendering.
    fetch(`${photo.downloadLocation}&client_id=${KEY}`).catch(() => {});
    return photo;
  } catch {
    return null;
  }
}
