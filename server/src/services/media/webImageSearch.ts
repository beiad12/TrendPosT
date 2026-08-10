import { unsplashConfigured, searchUnsplash } from "./sources/unsplash.js";
import { pexelsConfigured, searchPexels } from "./sources/pexels.js";

/**
 * A real photo found on the web, for trends whose own source article had
 * no image. Two optional stock-photo sources (Unsplash and Pexels — both
 * free, email-signup-only API keys), tried per query so a story that one
 * library's tagging misses still has a shot with the other. Reports as
 * simply having found nothing (never a thrown error) when neither is
 * configured or neither turns up a result — that's a routine, expected
 * outcome the caller falls through from, not a failure.
 */
export const webImageSearchConfigured = unsplashConfigured || pexelsConfigured;

const SOURCES: { name: string; configured: boolean; search: (query: string) => Promise<string | null> }[] = [
  { name: "Unsplash", configured: unsplashConfigured, search: searchUnsplash },
  { name: "Pexels", configured: pexelsConfigured, search: searchPexels },
];

/** Tries each query in order (most specific first), and each configured source per query, returning the first real result found. */
export async function searchWebImage(queries: string[]): Promise<string | null> {
  if (!webImageSearchConfigured) return null;

  for (const query of queries) {
    if (!query.trim()) continue;
    for (const source of SOURCES) {
      if (!source.configured) continue;
      try {
        const found = await source.search(query);
        if (found) return found;
      } catch (err) {
        console.log(`[Media] ${source.name} search failed for "${query}": ${(err as Error)?.message}`);
      }
    }
  }
  return null;
}
