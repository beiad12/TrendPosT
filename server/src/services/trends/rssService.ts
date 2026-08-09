import Parser from "rss-parser";
import { randomUUID } from "node:crypto";
import { RSS_SOURCES } from "./sources.js";
import type { NormalizedTrend } from "./types.js";

export type { NormalizedTrend };

const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
});

function extractImage(item: any): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  const mediaContent = item["media:content"];
  if (mediaContent?.$?.url) return mediaContent.$.url;
  const contentEncoded: string | undefined = item["content:encoded"] || item.content;
  if (contentEncoded) {
    const match = contentEncoded.match(/<img[^>]+src="([^"]+)"/i);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetches and normalizes the configured Moroccan news RSS feeds, tolerating
 * individual feed failures. Scoring (including cross-source duplicate
 * detection) happens once at the aggregator level in trends/aggregator.ts,
 * since the same story often breaks on RSS *and* Reddit *and* Google
 * Trends at once — this only returns raw, unscored items tagged with their
 * source.
 */
export async function fetchRssTrends(): Promise<Omit<NormalizedTrend, "score" | "scoreExplanation">[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      return (feed.items ?? []).slice(0, 20).map((item) => ({ source, item }));
    })
  );

  const flat = results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  return flat.map(({ source, item }) => {
    const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;
    return {
      id: randomUUID(),
      source: source.name,
      title: item.title ?? "(untitled)",
      url: item.link ?? "",
      imageUrl: extractImage(item),
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      language: source.language,
      category: item.categories?.[0] ?? "general",
    };
  });
}
