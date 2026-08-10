import Parser from "rss-parser";
import { buildCountryQueryGroup, GOOGLE_NEWS_QUERY_GROUPS, PROVIDERS_CONFIG, type QueryGroup } from "../config.js";
import { cleanUrl, domainFromUrl, stableIdFromUrl } from "../normalize.js";
import { mapWithConcurrency } from "../concurrency.js";
import type { Country } from "../countries.js";
import type { RawArticle } from "../types.js";
import type { TrendProvider } from "./types.js";

// news.google.com/rss/search is a different, still-functioning endpoint
// from the old "trendingsearches/daily/rss" one (which now 404s) -- this
// is the real replacement, not a URL swap of the same broken family.
// Overridable via env for local testing against a fixture server.
const BASE_URL = process.env.GOOGLE_NEWS_RSS_BASE || "https://news.google.com/rss/search";

const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendPostBot/1.0; +https://github.com/beiad12/trendpost)" },
});

function extractSourceName(item: any, fallbackTitle: string): string {
  const src = item.source;
  if (typeof src === "string" && src.trim()) return src.trim();
  if (src && typeof src === "object") {
    const text = src._ ?? src["#text"];
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  // Google News titles are conventionally "Headline - Source".
  const dashIdx = fallbackTitle.lastIndexOf(" - ");
  if (dashIdx > 0) return fallbackTitle.slice(dashIdx + 3).trim();
  return "Google News";
}

function stripSourceSuffix(title: string, sourceName: string): string {
  const suffix = ` - ${sourceName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

async function fetchQuery(group: QueryGroup, query: string, providerId = "google_news"): Promise<RawArticle[]> {
  const url = `${BASE_URL}?q=${encodeURIComponent(query)}&hl=${group.language}&gl=${group.country}&ceid=${group.country}:${group.language}`;
  const feed = await parser.parseURL(url);
  const now = new Date().toISOString();

  return (feed.items ?? []).slice(0, 12).map((item: any) => {
    const rawTitle: string = item.title ?? "(untitled)";
    const sourceName = extractSourceName(item, rawTitle);
    const title = stripSourceSuffix(rawTitle, sourceName);
    const link = cleanUrl(item.link ?? "");

    return {
      id: stableIdFromUrl(link || rawTitle),
      title,
      url: link,
      source: sourceName,
      sourceDomain: domainFromUrl(link),
      publishedAt: item.isoDate ? new Date(item.isoDate).toISOString() : item.pubDate ? new Date(item.pubDate).toISOString() : null,
      discoveredAt: now,
      language: group.language,
      country: group.country,
      categoryHint: group.categoryHint,
      description: typeof item.contentSnippet === "string" ? item.contentSnippet.slice(0, 300) : null,
      imageUrl: null, // Google News RSS doesn't reliably carry article images
      keywords: [query],
      provider: providerId,
    } satisfies RawArticle;
  });
}

/**
 * Google News search RSS, fanned out across configurable query groups
 * (Morocco Arabic / French / viral / sports / international, see
 * config.ts). Each query is isolated — one bad query never takes down the
 * others — and requests are capped to a modest concurrency so a refresh
 * doesn't hammer Google with dozens of simultaneous requests.
 */
export const googleNewsProvider: TrendProvider = {
  id: "google_news",
  name: "Google News",
  type: "search",
  enabled: PROVIDERS_CONFIG.googleNews.enabled,
  async fetch(): Promise<RawArticle[]> {
    const jobs = GOOGLE_NEWS_QUERY_GROUPS.flatMap((group) => group.queries.map((query) => ({ group, query })));
    const results = await mapWithConcurrency(jobs, 4, ({ group, query }) => fetchQuery(group, query));

    const articles: RawArticle[] = [];
    let failedQueries = 0;
    for (const r of results) {
      if (r.status === "fulfilled") articles.push(...r.value);
      else failedQueries++;
    }

    if (failedQueries > 0) {
      console.log(`[TrendEngine] ${JSON.stringify({ provider: "google_news", note: "some_queries_failed", failedQueries, totalQueries: jobs.length })}`);
    }
    if (articles.length === 0 && failedQueries === jobs.length) {
      throw new Error(`All ${jobs.length} Google News queries failed`);
    }
    return articles;
  },
};

/**
 * On-demand Google News fetch for an arbitrary country (the map/country
 * picker) — same fetch/isolation logic as the default provider, but scoped
 * to one country's generic query group instead of the curated Morocco set.
 * Tags articles with a per-country provider id (`google_news:MA`) so the
 * source-health panel and article store can track it independently.
 */
export async function fetchGoogleNewsForCountry(country: Country): Promise<RawArticle[]> {
  const group = buildCountryQueryGroup(country);
  const providerId = `google_news:${country.code}`;
  const results = await mapWithConcurrency(group.queries, 4, (query) => fetchQuery(group, query, providerId));

  const articles: RawArticle[] = [];
  let failedQueries = 0;
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
    else failedQueries++;
  }

  if (failedQueries > 0) {
    console.log(`[TrendEngine] ${JSON.stringify({ provider: providerId, note: "some_queries_failed", failedQueries, totalQueries: group.queries.length })}`);
  }
  if (articles.length === 0 && failedQueries === group.queries.length) {
    throw new Error(`All ${group.queries.length} Google News queries failed for ${country.name}`);
  }
  return articles;
}
