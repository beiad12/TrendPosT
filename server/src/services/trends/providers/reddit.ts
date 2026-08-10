import { PROVIDERS_CONFIG } from "../config.js";
import { cleanUrl, domainFromUrl, stableIdFromUrl } from "../normalize.js";
import type { RawArticle } from "../types.js";
import type { TrendProvider } from "./types.js";
import { fetchSubredditListing, extractRedditImage, type RedditPost } from "./redditClient.js";

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

async function fetchSubreddit(source: RedditSourceDef): Promise<RawArticle[]> {
  const posts: RedditPost[] = await fetchSubredditListing(source.subreddit, "hot", 25);
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
      imageUrl: extractRedditImage(post),
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
    const results = await Promise.allSettled(REDDIT_SOURCES.map((s) => fetchSubreddit(s)));
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
