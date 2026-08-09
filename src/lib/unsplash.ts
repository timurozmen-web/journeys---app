// Real, licensed destination photography via the Unsplash API.
// Cached in localStorage so repeat views of the same destination don't
// burn the (fairly small) hourly rate limit -- and so multiple trip cards
// to the same country only cost one API call, not one each.
const KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;
const CACHE_PREFIX = 'unsplash:';
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

export async function getDestinationPhoto(rawQuery: string): Promise<UnsplashPhoto | null> {
  const query = rawQuery.trim().toLowerCase();
  if (!KEY) return null; // no key configured -- caller falls back to the generated scene

  const cached = readCache(query);
  if (cached !== 'miss') return cached;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${KEY}`
    );
    if (!res.ok) {
      writeCache(query, null); // don't hammer the API for a query that's failing
      return null;
    }
    const data = await res.json();
    const first = data.results?.[0];
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
