import { cleanUrl, stableIdFromUrl } from "./normalize.js";
import { fetchSubredditListingAuto, extractRedditImage, type RedditPost } from "./providers/redditClient.js";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches every subreddit's listing. When using Reddit's OAuth API (a real
 * app configured) all requests fire at once — that quota is generous and
 * per-app. When falling back to the public unauthenticated endpoint (see
 * redditClient.ts#fetchSubredditListingPublic), firing all 12 requests
 * simultaneously from the same IP is exactly the burst pattern Reddit's
 * rate limiter is quickest to block — so those go out in small staggered
 * batches instead, trading a couple of extra seconds of latency for a much
 * better chance of actually getting data back.
 */
async function fetchAllSources(
  sources: typeof DRAMATIC_STORY_SOURCES,
  staggered: boolean
): Promise<PromiseSettledResult<{ source: (typeof sources)[number]; posts: RedditPost[] }>[]> {
  const fetchOne = (source: (typeof sources)[number]) =>
    fetchSubredditListingAuto(source.subreddit, "hot", 15).then((posts) => ({ source, posts }));

  if (!staggered) {
    return Promise.allSettled(sources.map(fetchOne));
  }

  const batchSize = 4;
  const results: PromiseSettledResult<{ source: (typeof sources)[number]; posts: RedditPost[] }>[] = [];
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    results.push(...(await Promise.allSettled(batch.map(fetchOne))));
    if (i + batchSize < sources.length) await sleep(600);
  }
  return results;
}

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
  /** true when this result came from Reddit's public unauthenticated endpoint (no REDDIT_CLIENT_ID/SECRET set) rather than the OAuth API. */
  usingFallback: boolean;
}

const usingOAuth = () => Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);

/**
 * Worldwide feed of real, dramatic, story-shaped Reddit posts — deliberately
 * separate from the Morocco-focused news engine (../engine.ts): no
 * moroccoRelevance weighting, no clustering across outlets (each post is
 * already a self-contained story), just "what's actually blowing up on
 * Reddit's real-story subs right now", ranked by Reddit's own engagement.
 *
 * Works with zero setup: when REDDIT_CLIENT_ID/SECRET aren't configured,
 * every fetch automatically falls back to Reddit's public unauthenticated
 * JSON endpoint (see providers/redditClient.ts#fetchSubredditListingAuto)
 * instead of requiring a Reddit developer app up front — `configured` only
 * goes false if that best-effort path also comes back completely empty.
 */
export async function getDramaticStories(forceRefresh = false): Promise<DramaticStoriesResult> {
  const usingFallback = !usingOAuth();

  if (!forceRefresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { stories: cache.stories, generatedAt: new Date(cache.at).toISOString(), configured: true, usingFallback };
  }

  const results = await fetchAllSources(DRAMATIC_STORY_SOURCES, usingFallback);

  const stories: NormalizedTrend[] = [];
  const seen = new Set<string>();
  let failedAll = true;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    failedAll = false;
    for (const post of r.value.posts) {
      const normalized = toNormalizedStory(post, r.value.source);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      stories.push(normalized);
    }
  }
  stories.sort((a, b) => b.score - a.score);

  if (failedAll) {
    return {
      stories: [],
      generatedAt: new Date().toISOString(),
      configured: false,
      usingFallback,
      reason: usingFallback
        ? "Reddit's public endpoint didn't respond (it can rate-limit or block unauthenticated access without notice) — add REDDIT_CLIENT_ID/SECRET for reliable access, or try Refresh again shortly."
        : "Every configured subreddit fetch failed — check the Reddit API credentials and try Refresh.",
    };
  }

  cache = { at: Date.now(), stories };
  return { stories, generatedAt: new Date(cache.at).toISOString(), configured: true, usingFallback };
}
