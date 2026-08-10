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

/** Fetches one subreddit listing (e.g. "hot", "top?t=day") as raw Reddit post objects via the OAuth API. */
export async function fetchSubredditListing(subreddit: string, listing = "hot", limit = 25): Promise<RedditPost[]> {
  const token = await getRedditAccessToken();
  const resp = await fetch(`https://oauth.reddit.com/r/${subreddit}/${listing}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": REDDIT_USER_AGENT },
  });
  if (!resp.ok) throw new Error(`r/${subreddit} fetch failed (${resp.status})`);
  const body = (await resp.json()) as { data?: { children?: { data: RedditPost }[] } };
  return body.data?.children?.map((c) => c.data) ?? [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSubredditListingPublicOnce(subreddit: string, listing: string, limit: number): Promise<RedditPost[]> {
  const resp = await fetch(`https://www.reddit.com/r/${subreddit}/${listing}.json?limit=${limit}&raw_json=1`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const err = new Error(`r/${subreddit} public fetch failed (${resp.status})`);
    (err as any).status = resp.status;
    throw err;
  }
  const body = (await resp.json()) as { data?: { children?: { data: RedditPost }[] } };
  return body.data?.children?.map((c) => c.data) ?? [];
}

/**
 * Fetches one subreddit listing via Reddit's plain, unauthenticated
 * `www.reddit.com/r/x/hot.json` endpoint — no app registration, no
 * REDDIT_CLIENT_ID/SECRET required. This is the endpoint Reddit itself
 * serves to a logged-out browser tab; a real desktop-browser User-Agent
 * (not a bot-labeled one) gets through in most deployments. It's
 * unofficial and best-effort — Reddit can rate-limit or block it without
 * notice — so a 429/403 gets two retries with backoff (this endpoint has
 * no OAuth quota to fall back on, so a transient block is worth a second
 * try) before the caller sees it as a real failure.
 */
export async function fetchSubredditListingPublic(subreddit: string, listing = "hot", limit = 25): Promise<RedditPost[]> {
  const delays = [400, 1200]; // two retries: ~0.4s, then ~1.2s
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fetchSubredditListingPublicOnce(subreddit, listing, limit);
    } catch (err) {
      lastErr = err;
      const status = (err as any)?.status;
      // Only rate-limit/transient-server codes are worth retrying; a hard block (403) or
      // not-found (404) won't succeed on a second try, so fail fast on those instead.
      const retryable = status === 429 || status === 503 || status === undefined;
      if (!retryable || attempt === delays.length) break;
      await sleep(delays[attempt]);
    }
  }
  throw lastErr;
}

/**
 * Fetches a subreddit listing using whichever access method is available:
 * the OAuth API when REDDIT_CLIENT_ID/SECRET are configured (reliable,
 * officially supported), otherwise the public unauthenticated endpoint
 * above (best-effort, no setup required). Lets a feature that just wants
 * "some Reddit posts" work out of the box while the main news engine's
 * Reddit provider (reddit.ts) still requires the real OAuth app for its
 * higher-volume, health-tracked usage.
 */
export async function fetchSubredditListingAuto(subreddit: string, listing = "hot", limit = 25): Promise<RedditPost[]> {
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    return fetchSubredditListing(subreddit, listing, limit);
  }
  return fetchSubredditListingPublic(subreddit, listing, limit);
}

export function extractRedditImage(post: RedditPost): string | null {
  const previewUrl = post.preview?.images?.[0]?.source?.url;
  if (previewUrl) return previewUrl.replace(/&amp;/g, "&");
  if (post.thumbnail && /^https?:\/\//.test(post.thumbnail)) return post.thumbnail;
  if (!post.is_self && /\.(jpe?g|png|webp|gif)$/i.test(post.url)) return post.url;
  return null;
}
