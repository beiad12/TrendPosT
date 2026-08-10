// Optional provider: a real photo found on the web, for trends whose own
// source article had no image. Requires a free Unsplash API access key
// (https://unsplash.com/developers -- email signup, no credit card) --
// without one this reports "not configured" and the caller falls through
// to the next option, same pattern as the trend engine's optional sources
// (Reddit, Google Trends).
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const BASE_URL = process.env.UNSPLASH_API_BASE || "https://api.unsplash.com";

export const webImageSearchConfigured = Boolean(UNSPLASH_ACCESS_KEY);

interface UnsplashPhoto {
  urls: { raw: string; regular: string };
}

async function searchOnce(query: string): Promise<string | null> {
  const url = `${BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish&content_filter=high`;
  const resp = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
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

/**
 * Tries each query in order (most specific first) and returns the first
 * real result found — null (not a thrown error) when nothing turns up or
 * the feature isn't configured, since "no web photo found" is an expected,
 * routine outcome the caller falls through from, not a failure.
 */
export async function searchWebImage(queries: string[]): Promise<string | null> {
  if (!webImageSearchConfigured) return null;

  for (const query of queries) {
    if (!query.trim()) continue;
    try {
      const found = await searchOnce(query);
      if (found) return found;
    } catch (err) {
      console.log(`[Media] web image search failed for "${query}": ${(err as Error)?.message}`);
    }
  }
  return null;
}
