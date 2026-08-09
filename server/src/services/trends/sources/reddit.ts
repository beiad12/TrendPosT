import { randomUUID } from "node:crypto";
import type { NormalizedTrend } from "../types.js";

export interface RedditSource {
  subreddit: string;
  label: string;
  language: string;
}

/**
 * r/Morocco covers what Moroccans themselves are discussing; r/popular is
 * Reddit's own cross-site "what's hot right now" front page (no single
 * subreddit, aggregated across all of Reddit) -- the closest free,
 * no-API-key signal for "what's going viral worldwide" that Reddit exposes.
 */
export const REDDIT_SOURCES: RedditSource[] = [
  { subreddit: "Morocco", label: "Reddit r/Morocco", language: "fr" },
  { subreddit: "popular", label: "Reddit r/popular (worldwide)", language: "en" },
];

interface RedditPost {
  title: string;
  permalink: string;
  url: string;
  created_utc: number;
  thumbnail?: string;
  preview?: { images?: { source?: { url?: string } }[] };
  link_flair_text?: string | null;
  is_self: boolean;
  subreddit?: string;
}

function extractImage(post: RedditPost): string | null {
  const previewUrl = post.preview?.images?.[0]?.source?.url;
  if (previewUrl) return previewUrl.replace(/&amp;/g, "&"); // reddit HTML-escapes preview URLs
  if (post.thumbnail && /^https?:\/\//.test(post.thumbnail)) return post.thumbnail;
  if (!post.is_self && /\.(jpe?g|png|webp|gif)$/i.test(post.url)) return post.url;
  return null;
}

/**
 * Free, no-API-key feed: a subreddit's "hot" listing via Reddit's public
 * JSON endpoint (no OAuth needed for read-only access to a public
 * listing). Reddit requires a descriptive User-Agent or it 429s.
 */
export async function fetchRedditTrends(
  source: RedditSource
): Promise<Omit<NormalizedTrend, "score" | "scoreExplanation">[]> {
  const url = `https://www.reddit.com/r/${source.subreddit}/hot.json?limit=25`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
  });
  if (!resp.ok) throw new Error(`${source.label} fetch failed (${resp.status})`);
  const body = (await resp.json()) as { data?: { children?: { data: RedditPost }[] } };
  const posts = body.data?.children?.map((c) => c.data) ?? [];

  return posts.map((post) => ({
    id: randomUUID(),
    source: source.label,
    title: post.title ?? "(untitled)",
    url: `https://www.reddit.com${post.permalink}`,
    imageUrl: extractImage(post),
    publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
    language: source.language,
    category: post.link_flair_text ?? (post.subreddit ? `r/${post.subreddit}` : "general"),
  }));
}
