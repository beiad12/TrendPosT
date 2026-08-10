/**
 * Shared Reddit OAuth + fetch plumbing, used by both the main trend
 * engine's Reddit provider (reddit.ts) and the standalone worldwide
 * "Dramatic Stories" feed (../dramaticStories.ts) — one token cache, one
 * fetch helper, instead of two copies drifting apart.
 */

export interface RedditPost {
  title: string;
  permalink: string;
  url: string;
  created_utc: number;
  thumbnail?: string;
  preview?: { images?: { source?: { url?: string } }[] };
  link_flair_text?: string | null;
  is_self: boolean;
  subreddit?: string;
  score?: number;
  ups?: number;
  num_comments?: number;
  over_18?: boolean;
}

export const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)";

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Reddit's public JSON endpoints (`reddit.com/r/x/hot.json`) 403 for most
 * non-browser clients now — this uses the real OAuth `client_credentials`
 * app-only flow instead, which Reddit's API actually supports for
 * read-only access. Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (a
 * free Reddit "script" app); entirely optional otherwise.
 */
export async function getRedditAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;

  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;

  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) throw new Error(`Reddit OAuth token request failed (${resp.status})`);
  const body = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.token;
}

/** Fetches one subreddit listing (e.g. "hot", "top?t=day") as raw Reddit post objects. */
export async function fetchSubredditListing(subreddit: string, listing = "hot", limit = 25): Promise<RedditPost[]> {
  const token = await getRedditAccessToken();
  const resp = await fetch(`https://oauth.reddit.com/r/${subreddit}/${listing}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": REDDIT_USER_AGENT },
  });
  if (!resp.ok) throw new Error(`r/${subreddit} fetch failed (${resp.status})`);
  const body = (await resp.json()) as { data?: { children?: { data: RedditPost }[] } };
  return body.data?.children?.map((c) => c.data) ?? [];
}

export function extractRedditImage(post: RedditPost): string | null {
  const previewUrl = post.preview?.images?.[0]?.source?.url;
  if (previewUrl) return previewUrl.replace(/&amp;/g, "&");
  if (post.thumbnail && /^https?:\/\//.test(post.thumbnail)) return post.thumbnail;
  if (!post.is_self && /\.(jpe?g|png|webp|gif)$/i.test(post.url)) return post.url;
  return null;
}
