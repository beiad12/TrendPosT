import Parser from "rss-parser";
import { randomUUID } from "node:crypto";
import { RSS_SOURCES } from "./sources.js";
import { scoreTrend } from "./scoring.js";

const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
});

export interface NormalizedTrend {
  id: string;
  source: string;
  title: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  language: string;
  category: string;
  score: number;
  scoreExplanation: string;
}

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

/** Fetches and normalizes all configured RSS sources, tolerating individual feed failures. */
export async function fetchAllTrends(): Promise<NormalizedTrend[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      return (feed.items ?? []).slice(0, 20).map((item) => ({ source, item }));
    })
  );

  const flat = results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // crude duplicate-story detection across sources: same normalized title prefix
  const titleCounts = new Map<string, number>();
  for (const { item } of flat) {
    const key = String(item.title ?? "").toLowerCase().slice(0, 40);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  const trends: NormalizedTrend[] = flat.map(({ source, item }) => {
    const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;
    const key = String(item.title ?? "").toLowerCase().slice(0, 40);
    const duplicateCount = (titleCounts.get(key) ?? 1) - 1;

    const { score, explanation } = scoreTrend({
      title: item.title ?? "",
      publishedAt,
      duplicateCount,
    });

    return {
      id: randomUUID(),
      source: source.name,
      title: item.title ?? "(untitled)",
      url: item.link ?? "",
      imageUrl: extractImage(item),
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      language: source.language,
      category: item.categories?.[0] ?? "general",
      score,
      scoreExplanation: explanation,
    };
  });

  trends.sort((a, b) => b.score - a.score);
  return trends;
}
