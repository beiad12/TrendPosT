// Optional web image search source. Requires a free Unsplash API access
// key (https://unsplash.com/developers -- email signup, no credit card).
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const BASE_URL = process.env.UNSPLASH_API_BASE || "https://api.unsplash.com";

export const unsplashConfigured = Boolean(ACCESS_KEY);

interface UnsplashPhoto {
  urls: { raw: string; regular: string };
}

/** Returns a real photo URL, null when this query has no results, or throws on a real request failure. */
export async function searchUnsplash(query: string): Promise<string | null> {
  const url = `${BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish&content_filter=high`;
  const resp = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });
  if (!resp.ok) throw new Error(`Unsplash search failed (${resp.status})`);
  const body = (await resp.json()) as { results?: UnsplashPhoto[] };
  const photo = body.results?.[0];
  if (!photo) return null;
  // `raw` + explicit sizing gives a large-enough source for the render
  // pipeline's native 4K compositing (see renderEngine.ts) instead of
  // Unsplash's smaller pre-cropped `regular` size.
  return `${photo.urls.raw}&w=2400&q=80&fm=jpg`;
}
