import { PROVIDERS_CONFIG } from "../config.js";
import { cleanUrl, domainFromUrl, stableIdFromUrl } from "../normalize.js";
import { mapWithConcurrency } from "../concurrency.js";
import type { Country } from "../countries.js";
import type { RawArticle } from "../types.js";
import type { TrendProvider } from "./types.js";

// GDELT DOC 2.0 -- free, no API key, independent of Google/Reddit entirely.
// Overridable via env for local testing against a fixture server.
const BASE_URL = process.env.GDELT_API_BASE || "https://api.gdeltproject.org/api/v2/doc/doc";

const GDELT_QUERIES = [
  "Morocco",
  "Maroc",
  "Moroccan politics",
  "Moroccan sports",
  "Moroccan entertainment",
];

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string; // "20260809T182015Z"
  domain: string;
  language?: string;
  sourcecountry?: string;
  socialimage?: string;
}

function parseGdeltDate(seendate: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
}

async function fetchQuery(query: string, providerId = "gdelt", overrideCountry?: string): Promise<RawArticle[]> {
  const url = `${BASE_URL}?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=40&format=json&sort=datedesc`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
  });
  if (!resp.ok) throw new Error(`GDELT query "${query}" failed (${resp.status})`);

  const text = await resp.text();
  let body: { articles?: GdeltArticle[] };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`GDELT query "${query}" returned invalid JSON`);
  }

  const now = new Date().toISOString();
  return (body.articles ?? []).map((a) => {
    const link = cleanUrl(a.url ?? "");
    return {
      id: stableIdFromUrl(link || a.title),
      title: a.title ?? "(untitled)",
      url: link,
      source: a.domain ?? domainFromUrl(link) ?? "GDELT",
      sourceDomain: a.domain ?? domainFromUrl(link),
      publishedAt: parseGdeltDate(a.seendate ?? ""),
      discoveredAt: now,
      language: a.language ?? "unknown",
      // GDELT's own sourcecountry is the article's *publisher's* country, not
      // necessarily the country the query was targeting -- when fetching for
      // a specific selected country, tag with that country's code so it
      // groups correctly regardless of which outlet happened to publish it.
      country: overrideCountry ?? a.sourcecountry ?? "unknown",
      categoryHint: "world",
      description: null,
      imageUrl: a.socialimage || null,
      keywords: [query],
      provider: providerId,
    } satisfies RawArticle;
  });
}

/**
 * GDELT DOC 2.0 — an independent news-monitoring signal (not affiliated
 * with Google or Reddit), queried for Morocco-related terms across
 * politics/sports/entertainment. Each query is isolated so a single bad
 * one doesn't take the provider down.
 */
export const gdeltProvider: TrendProvider = {
  id: "gdelt",
  name: "GDELT",
  type: "api",
  enabled: PROVIDERS_CONFIG.gdelt.enabled,
  async fetch(): Promise<RawArticle[]> {
    const results = await mapWithConcurrency(GDELT_QUERIES, 3, (query) => fetchQuery(query));

    const articles: RawArticle[] = [];
    let failed = 0;
    for (const r of results) {
      if (r.status === "fulfilled") articles.push(...r.value);
      else failed++;
    }

    if (articles.length === 0 && failed === GDELT_QUERIES.length) {
      throw new Error(`All ${GDELT_QUERIES.length} GDELT queries failed`);
    }
    return articles;
  },
};

/**
 * On-demand GDELT fetch for an arbitrary country (the map/country picker),
 * queried by country name alone (GDELT's DOC 2.0 free tier query language
 * doesn't reliably support a `sourcecountry:` filter by ISO code across all
 * countries, so a plain name search is the robust choice here).
 */
export async function fetchGdeltForCountry(country: Country): Promise<RawArticle[]> {
  const providerId = `gdelt:${country.code}`;
  const queries = [country.name, `${country.name} news`];
  const results = await mapWithConcurrency(queries, 2, (q) => fetchQuery(q, providerId, country.code));

  const articles: RawArticle[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
    else failed++;
  }

  if (articles.length === 0 && failed === queries.length) {
    throw new Error(`All ${queries.length} GDELT queries failed for ${country.name}`);
  }
  return articles;
}
