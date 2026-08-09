import Parser from "rss-parser";
import { RSS_SOURCES, type RssSource } from "../sources.js";
import { PROVIDERS_CONFIG } from "../config.js";
import { cleanUrl, domainFromUrl, stableIdFromUrl } from "../normalize.js";
import { isBackedOff, recordAttempt, recordFailure, recordSuccess } from "../sourceHealth.js";
import type { RawArticle } from "../types.js";
import type { TrendProvider } from "./types.js";

const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
});

function healthId(source: RssSource): string {
  return `publisher_rss:${source.id}`;
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

interface FeedOutcome {
  items: RawArticle[];
  /** False when skipped entirely because the feed is still in its backoff window — that's not a fresh failure, just nothing to report this round. */
  attempted: boolean;
  ok: boolean;
}

async function fetchOneFeed(source: RssSource): Promise<FeedOutcome> {
  const id = healthId(source);
  if (isBackedOff(id)) return { items: [], attempted: false, ok: true };

  recordAttempt(id, source.name);
  const start = Date.now();
  try {
    const feed = await parser.parseURL(source.url);
    const now = new Date().toISOString();
    const items: RawArticle[] = (feed.items ?? []).slice(0, 20).map((item) => {
      const link = cleanUrl(item.link ?? "");
      const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;
      return {
        id: stableIdFromUrl(link || item.title || source.url),
        title: item.title ?? "(untitled)",
        url: link,
        source: source.name,
        sourceDomain: domainFromUrl(link) || new URL(source.url).hostname.replace(/^www\./, ""),
        publishedAt: publishedAt ? publishedAt.toISOString() : null,
        discoveredAt: now,
        language: source.language,
        country: "MA",
        categoryHint: item.categories?.[0] ?? "morocco",
        description: typeof item.contentSnippet === "string" ? item.contentSnippet.slice(0, 300) : null,
        imageUrl: extractImage(item),
        keywords: [],
        provider: `publisher_rss:${source.id}`,
      };
    });
    recordSuccess(id, source.name, items.length, Date.now() - start);
    return { items, attempted: true, ok: true };
  } catch (err: any) {
    const code = /status code (\d+)/i.exec(String(err?.message ?? ""))?.[1];
    recordFailure(id, source.name, err, code ? Number(code) : undefined);
    return { items: [], attempted: true, ok: false };
  }
}

/**
 * A secondary signal now (Google News + GDELT are primary): known
 * Moroccan publishers' own RSS feeds, each tracked and backed off
 * *individually* by sourceHealth.ts — a feed that starts 404ing gets
 * skipped for a while instead of being retried on every single request.
 */
export const publisherRssProvider: TrendProvider = {
  id: "publisher_rss",
  name: "Publisher RSS",
  type: "rss",
  enabled: PROVIDERS_CONFIG.publisherRss.enabled,
  async fetch(): Promise<RawArticle[]> {
    const outcomes = await Promise.all(RSS_SOURCES.map(fetchOneFeed));
    const items = outcomes.flatMap((o) => o.items);

    // Only throw (marking this provider itself degraded at the engine level)
    // when every feed that was actually attempted this round failed — a
    // provider that resolves with 0 items purely because everything is
    // still cooling down in backoff is a legitimately quiet round, not a
    // fresh failure, and shouldn't corrupt the engine's "did anything
    // succeed" signal the same way a real failure should.
    const attempted = outcomes.filter((o) => o.attempted);
    if (items.length === 0 && attempted.length > 0 && attempted.every((o) => !o.ok)) {
      throw new Error(`All ${attempted.length} publisher RSS feeds failed`);
    }
    return items;
  },
};
