import { PROVIDERS_CONFIG } from "../config.js";
import { cleanUrl, domainFromUrl, stableIdFromUrl } from "../normalize.js";
import type { RawArticle } from "../types.js";
import type { TrendProvider } from "./types.js";

export interface RedditSourceDef {
  subreddit: string;
  label: string;
  language: string;
}

/** r/Morocco covers local discussion; r/popular is Reddit's own cross-site "hot right now" front page — the closest OAuth-backed signal for "what's going viral" globally. */
const REDDIT_SOURCES: RedditSourceDef[] = [
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

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Reddit's public JSON endpoints (`reddit.com/r/x/hot.json`) 403 for most
 * non-browser clients now — this uses the real OAuth `client_credentials`
 * app-only flow instead, which Reddit's API actually supports for
 * read-only access. Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (a
 * free Reddit "script" app); entirely optional otherwise.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;

  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  const userAgent = process.env.REDDIT_USER_AGENT || "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)";

  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) throw new Error(`Reddit OAuth token request failed (${resp.status})`);
  const body = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.token;
}

function extractImage(post: RedditPost): string | null {
  const previewUrl = post.preview?.images?.[0]?.source?.url;
  if (previewUrl) return previewUrl.replace(/&amp;/g, "&");
  if (post.thumbnail && /^https?:\/\//.test(post.thumbnail)) return post.thumbnail;
  if (!post.is_self && /\.(jpe?g|png|webp|gif)$/i.test(post.url)) return post.url;
  return null;
}

async function fetchSubreddit(source: RedditSourceDef, userAgent: string): Promise<RawArticle[]> {
  const token = await getAccessToken();
  const resp = await fetch(`https://oauth.reddit.com/r/${source.subreddit}/hot?limit=25`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent },
  });
  if (!resp.ok) throw new Error(`${source.label} fetch failed (${resp.status})`);
  const body = (await resp.json()) as { data?: { children?: { data: RedditPost }[] } };
  const posts = body.data?.children?.map((c) => c.data) ?? [];
  const now = new Date().toISOString();

  return posts.map((post) => {
    const link = cleanUrl(`https://www.reddit.com${post.permalink}`);
    return {
      id: stableIdFromUrl(link),
      title: post.title ?? "(untitled)",
      url: link,
      source: source.label,
      sourceDomain: domainFromUrl(link) || "reddit.com",
      publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
      discoveredAt: now,
      language: source.language,
      country: source.subreddit === "Morocco" ? "MA" : "world",
      categoryHint: post.link_flair_text ?? (post.subreddit ? `r/${post.subreddit}` : "general"),
      description: null,
      imageUrl: extractImage(post),
      keywords: [],
      provider: `reddit:${source.subreddit}`,
    } satisfies RawArticle;
  });
}

export const redditProvider: TrendProvider = {
  id: "reddit",
  name: "Reddit",
  type: "social",
  enabled: PROVIDERS_CONFIG.reddit.enabled,
  disabledReason: PROVIDERS_CONFIG.reddit.reason,
  async fetch(): Promise<RawArticle[]> {
    const userAgent = process.env.REDDIT_USER_AGENT || "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)";
    const results = await Promise.allSettled(REDDIT_SOURCES.map((s) => fetchSubreddit(s, userAgent)));
    const articles: RawArticle[] = [];
    let failed = 0;
    for (const r of results) {
      if (r.status === "fulfilled") articles.push(...r.value);
      else failed++;
    }
    if (articles.length === 0 && failed === REDDIT_SOURCES.length) {
      throw new Error("All Reddit subreddits failed");
    }
    return articles;
  },
};
