import { PROVIDERS_CONFIG } from "./config.js";
import { cleanUrl, stableIdFromUrl } from "./normalize.js";
import { fetchSubredditListing, extractRedditImage, type RedditPost } from "./providers/redditClient.js";
import type { NormalizedTrend, ScoreBreakdown } from "./types.js";

/**
 * Curated worldwide, real-story subreddits — not Morocco/language-scoped
 * like the main dashboard. Every one of these is real first-person
 * accounts (confessions, workplace/family drama, real disputes, real
 * viral incidents), not fiction (no r/nosleep-style horror-fiction subs),
 * so "create a post from it" always points at something that actually
 * happened to someone.
 */
const DRAMATIC_STORY_SOURCES: { subreddit: string; label: string }[] = [
  { subreddit: "tifu", label: "r/tifu" },
  { subreddit: "AmItheAsshole", label: "r/AmItheAsshole" },
  { subreddit: "relationship_advice", label: "r/relationship_advice" },
  { subreddit: "TrueOffMyChest", label: "r/TrueOffMyChest" },
  { subreddit: "EntitledParents", label: "r/EntitledParents" },
  { subreddit: "ProRevenge", label: "r/ProRevenge" },
  { subreddit: "pettyrevenge", label: "r/pettyrevenge" },
  { subreddit: "MaliciousCompliance", label: "r/MaliciousCompliance" },
  { subreddit: "JUSTNOMIL", label: "r/JUSTNOMIL" },
  { subreddit: "BestofRedditorUpdates", label: "r/BestofRedditorUpdates" },
  { subreddit: "PublicFreakout", label: "r/PublicFreakout" },
  { subreddit: "nottheonion", label: "r/nottheonion" },
];

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; stories: NormalizedTrend[] } | null = null;

function ageMinutesOf(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(publishedAt).getTime()) / 60_000));
}

/**
 * Reddit's own upvotes/comment count are the "how much did this actually
 * grab people" signal here (there's no cross-outlet corroboration to
 * measure, unlike the news engine's clustering) — log-scaled so a single
 * 50k-upvote post doesn't blow the 0-100 scale, then lightly boosted for
 * freshness so the feed doesn't go permanently stale with the same old
 * mega-viral posts.
 */
function scoreStory(ups: number, comments: number, ageMinutes: number): number {
  const upsScore = Math.log10(Math.max(1, ups) + 1) * 14;
  const commentsScore = Math.log10(Math.max(1, comments) + 1) * 10;
  const freshnessBoost = ageMinutes < 360 ? 12 : ageMinutes < 1440 ? 6 : 0;
  return Math.max(1, Math.min(100, Math.round(upsScore + commentsScore + freshnessBoost)));
}

function emptyBreakdown(total: number): ScoreBreakdown {
  return { freshness: 0, sourceCount: 0, velocity: 0, moroccoRelevance: 0, social: total, category: 0, viralPotential: total, total };
}

function toNormalizedStory(post: RedditPost, source: { subreddit: string; label: string }): NormalizedTrend | null {
  if (post.over_18 || !post.title) return null;
  const link = cleanUrl(`https://www.reddit.com${post.permalink}`);
  const publishedAt = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null;
  const ageMinutes = ageMinutesOf(publishedAt);
  const ups = post.ups ?? post.score ?? 0;
  const comments = post.num_comments ?? 0;
  const score = scoreStory(ups, comments, ageMinutes);

  return {
    id: stableIdFromUrl(link),
    source: source.label,
    title: post.title,
    url: link,
    imageUrl: extractRedditImage(post),
    publishedAt,
    language: "en",
    category: "dramatic-story",
    score,
    scoreExplanation: `🎬 Real story · ${ups.toLocaleString()} upvotes · ${comments.toLocaleString()} comments`,
    summary: null,
    sourceCount: 1,
    sources: [source.label],
    trendType: "VIRAL",
    categoryEmoji: "🎬",
    ageMinutes,
    velocityPerHour: 0,
    scoreBreakdown: emptyBreakdown(score),
    articleCount: 1,
  };
}

export interface DramaticStoriesResult {
  stories: NormalizedTrend[];
  generatedAt: string;
  configured: boolean;
  reason?: string;
}

/**
 * Worldwide feed of real, dramatic, story-shaped Reddit posts — deliberately
 * separate from the Morocco-focused news engine (../engine.ts): no
 * moroccoRelevance weighting, no clustering across outlets (each post is
 * already a self-contained story), just "what's actually blowing up on
 * Reddit's real-story subs right now", ranked by Reddit's own engagement.
 */
export async function getDramaticStories(forceRefresh = false): Promise<DramaticStoriesResult> {
  if (!PROVIDERS_CONFIG.reddit.enabled) {
    return { stories: [], generatedAt: new Date().toISOString(), configured: false, reason: PROVIDERS_CONFIG.reddit.reason };
  }

  if (!forceRefresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { stories: cache.stories, generatedAt: new Date(cache.at).toISOString(), configured: true };
  }

  const results = await Promise.allSettled(
    DRAMATIC_STORY_SOURCES.map((source) => fetchSubredditListing(source.subreddit, "hot", 15).then((posts) => ({ source, posts })))
  );

  const stories: NormalizedTrend[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const post of r.value.posts) {
      const normalized = toNormalizedStory(post, r.value.source);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      stories.push(normalized);
    }
  }
  stories.sort((a, b) => b.score - a.score);

  cache = { at: Date.now(), stories };
  return { stories, generatedAt: new Date(cache.at).toISOString(), configured: true };
}
