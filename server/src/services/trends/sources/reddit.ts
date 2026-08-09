import { randomUUID } from "node:crypto";
import type { NormalizedTrend } from "../types.js";

const REDDIT_MOROCCO_HOT = "https://www.reddit.com/r/Morocco/hot.json?limit=25";

interface RedditPost {
  title: string;
  permalink: string;
  url: string;
  created_utc: number;
  thumbnail?: string;
  preview?: { images?: { source?: { url?: string } }[] };
  link_flair_text?: string | null;
  is_self: boolean;
}

function extractImage(post: RedditPost): string | null {
  const previewUrl = post.preview?.images?.[0]?.source?.url;
  if (previewUrl) return previewUrl.replace(/&amp;/g, "&"); // reddit HTML-escapes preview URLs
  if (post.thumbnail && /^https?:\/\//.test(post.thumbnail)) return post.thumbnail;
  if (!post.is_self && /\.(jpe?g|png|webp|gif)$/i.test(post.url)) return post.url;
  return null;
}

/**
 * Free, no-API-key feed: r/Morocco's hot listing via Reddit's public JSON
 * endpoint (no OAuth needed for read-only access to a subreddit's public
 * listing). Reddit requires a descriptive User-Agent or it 429s.
 */
export async function fetchRedditTrends(): Promise<Omit<NormalizedTrend, "score" | "scoreExplanation">[]> {
  const resp = await fetch(REDDIT_MOROCCO_HOT, {
    headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
  });
  if (!resp.ok) throw new Error(`Reddit fetch failed (${resp.status})`);
  const body = (await resp.json()) as { data?: { children?: { data: RedditPost }[] } };
  const posts = body.data?.children?.map((c) => c.data) ?? [];

  return posts.map((post) => ({
    id: randomUUID(),
    source: "Reddit r/Morocco",
    title: post.title ?? "(untitled)",
    url: `https://www.reddit.com${post.permalink}`,
    imageUrl: extractImage(post),
    publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
    language: "fr",
    category: post.link_flair_text ?? "general",
  }));
}
