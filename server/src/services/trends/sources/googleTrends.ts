import Parser from "rss-parser";
import { randomUUID } from "node:crypto";
import type { NormalizedTrend } from "../types.js";

// Google Trends' daily-trends RSS uses a custom "ht:" namespace for extra
// fields (approx_traffic, picture, news_item children) that rss-parser
// doesn't know about by default -- register them so they land on each item.
const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
  customFields: {
    item: [
      ["ht:approx_traffic", "approxTraffic"],
      ["ht:picture", "picture"],
      ["ht:news_item_url", "newsItemUrl"],
    ],
  },
});

const GOOGLE_TRENDS_MA_RSS = "https://trends.google.com/trends/trendingsearches/daily/rss?geo=MA";

/**
 * Free, no-API-key feed: Google's own "what's trending right now" list for
 * Morocco. No article photo is guaranteed per entry (Google sometimes
 * includes one under ht:picture, sometimes not) -- callers should treat
 * imageUrl as optional here, same as any other source.
 */
export async function fetchGoogleTrends(): Promise<Omit<NormalizedTrend, "score" | "scoreExplanation">[]> {
  const feed = await parser.parseURL(GOOGLE_TRENDS_MA_RSS);
  return (feed.items ?? []).slice(0, 25).map((item: any) => ({
    id: randomUUID(),
    source: "Google Trends (MA)",
    title: item.title ?? "(untitled)",
    url: item.link ?? item.newsItemUrl ?? "",
    imageUrl: typeof item.picture === "string" ? item.picture : null,
    publishedAt: item.isoDate ? new Date(item.isoDate).toISOString() : item.pubDate ? new Date(item.pubDate).toISOString() : null,
    language: "fr",
    category: "trending",
  }));
}
