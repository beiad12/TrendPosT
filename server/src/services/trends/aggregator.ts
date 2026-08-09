import { fetchRssTrends } from "./rssService.js";
import { fetchGoogleTrends, GOOGLE_TRENDS_GEOS } from "./sources/googleTrends.js";
import { fetchRedditTrends, REDDIT_SOURCES } from "./sources/reddit.js";
import { scoreTrend } from "./scoring.js";
import type { NormalizedTrend } from "./types.js";

export type { NormalizedTrend };

// X/Twitter's "what's trending" data requires a paid API tier (Basic/Pro) --
// there's no free, no-key public endpoint for it the way there is for
// Google Trends' RSS or Reddit's public JSON listings. The extension point
// is here: add a `fetchXTrends()` in ./sources/x.ts returning the same
// Omit<NormalizedTrend, "score" | "scoreExplanation">[] shape and add it to
// the fetchers list below once real API credentials are available. It's
// intentionally not stubbed with fake data.

type Unscored = Omit<NormalizedTrend, "score" | "scoreExplanation">;

interface NamedFetch {
  label: string;
  run: () => Promise<Unscored[]>;
}

function buildFetchers(): NamedFetch[] {
  const fetchers: NamedFetch[] = [{ label: "RSS (Moroccan news)", run: fetchRssTrends }];
  for (const geo of GOOGLE_TRENDS_GEOS) {
    fetchers.push({ label: geo.label, run: () => fetchGoogleTrends(geo) });
  }
  for (const source of REDDIT_SOURCES) {
    fetchers.push({ label: source.label, run: () => fetchRedditTrends(source) });
  }
  return fetchers;
}

/**
 * Combines every configured trend source -- Moroccan news RSS, Google
 * Trends (Morocco + a couple of the world's highest-traffic geos, as a
 * "what's trending in the world" proxy), and Reddit (r/Morocco +
 * r/popular, Reddit's own cross-site "going viral right now" listing) --
 * into one unified, scored, sorted list: the same dashboard feed
 * regardless of where a given story is trending. Each source's failure is
 * isolated (Promise.allSettled) so one dead feed doesn't take down the
 * others, and is logged (not silently swallowed) so a source that's
 * failing on your network is visible in the server console instead of
 * just quietly missing from the dashboard.
 */
export async function fetchAllTrends(): Promise<NormalizedTrend[]> {
  const fetchers = buildFetchers();
  const settled = await Promise.allSettled(fetchers.map((f) => f.run()));

  const unscored: Unscored[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      unscored.push(...result.value);
    } else {
      console.error(`[trends] source "${fetchers[i].label}" failed:`, result.reason?.message ?? result.reason);
    }
  });

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
