import { fetchRssTrends } from "./rssService.js";
import { fetchGoogleTrends } from "./sources/googleTrends.js";
import { fetchRedditTrends } from "./sources/reddit.js";
import { scoreTrend } from "./scoring.js";
import type { NormalizedTrend } from "./types.js";

export type { NormalizedTrend };

// X/Twitter's "what's trending" data requires a paid API tier (Basic/Pro) --
// there's no free, no-key public endpoint for it the way there is for
// Google Trends' RSS or Reddit's public JSON listings. The extension point
// is here: add a `fetchXTrends()` in ./sources/x.ts returning the same
// Omit<NormalizedTrend, "score" | "scoreExplanation">[] shape and add it to
// the Promise.allSettled list below once real API credentials are available.
// It's intentionally not stubbed with fake data.

/**
 * Combines every configured trend source (Moroccan news RSS feeds, Google
 * Trends Morocco, Reddit r/Morocco) into one unified, scored, sorted list --
 * the same dashboard feed regardless of where a given story is trending.
 * Each source's failure is isolated (Promise.allSettled) so one dead feed
 * doesn't take down the others.
 */
export async function fetchAllTrends(): Promise<NormalizedTrend[]> {
  const settled = await Promise.allSettled([fetchRssTrends(), fetchGoogleTrends(), fetchRedditTrends()]);

  const unscored = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // Cross-source duplicate detection: the same breaking story often shows up
  // on a news RSS feed, in Google's trending list, and on Reddit all at
  // once -- that corroboration is a real signal (scoring.ts turns it into a
  // small bonus, then a saturation penalty once too many sources have it),
  // not just an RSS-internal quirk.
  const titleCounts = new Map<string, number>();
  for (const t of unscored) {
    const key = t.title.toLowerCase().slice(0, 40);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  const trends: NormalizedTrend[] = unscored.map((t) => {
    const key = t.title.toLowerCase().slice(0, 40);
    const duplicateCount = (titleCounts.get(key) ?? 1) - 1;
    const publishedAt = t.publishedAt ? new Date(t.publishedAt) : null;
    const { score, explanation } = scoreTrend({ title: t.title, publishedAt, duplicateCount });
    return { ...t, score, scoreExplanation: explanation };
  });

  trends.sort((a, b) => b.score - a.score);
  return trends;
}
