// Optional web image search source, alongside Unsplash — trying two stock
// libraries instead of one means a story that Unsplash's tagging misses
// still has a real shot at turning up a photo. Requires a free Pexels API
// key (https://www.pexels.com/api/ -- email signup, no credit card).
const API_KEY = process.env.PEXELS_API_KEY;
const BASE_URL = process.env.PEXELS_API_BASE || "https://api.pexels.com/v1";

export const pexelsConfigured = Boolean(API_KEY);

interface PexelsPhoto {
  src: { original: string; large2x: string; large: string };
}

/** Returns a real photo URL, null when this query has no results, or throws on a real request failure. */
export async function searchPexels(query: string): Promise<string | null> {
  const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}&per_page=1&orientation=square`;
  const resp = await fetch(url, {
    headers: { Authorization: API_KEY! },
  });
  if (!resp.ok) throw new Error(`Pexels search failed (${resp.status})`);
  const body = (await resp.json()) as { photos?: PexelsPhoto[] };
  const photo = body.photos?.[0];
  if (!photo) return null;
  // `large2x` (~1880px wide) is Pexels' largest fixed-size option — a solid
  // source for the render pipeline's native 4K compositing (see renderEngine.ts).
  return photo.src.large2x || photo.src.original || photo.src.large;
}
