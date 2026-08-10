import { ALL_PROVIDERS } from "./providers/index.js";
import { fetchGoogleNewsForCountry } from "./providers/googleNews.js";
import { fetchGdeltForCountry } from "./providers/gdelt.js";
import { upsertArticles, getRecentArticles, cleanupOldArticles } from "./articleStore.js";
import { clusterArticles } from "./clustering.js";
import { scoreCluster, escapeRegExp } from "./scoring.js";
import { recordAttempt, recordSuccess, recordFailure, recordNotConfigured, isBackedOff, getAllHealth } from "./sourceHealth.js";
import { CACHE_TTL_MS, MAX_ARTICLE_AGE_HOURS } from "./config.js";
import type { Country } from "./countries.js";
import type { ProviderHealth, RawArticle, TrendCluster } from "./types.js";

export interface TrendEngineResult {
  trends: TrendCluster[];
  generatedAt: string;
  sourceHealth: ProviderHealth[];
  /** Set when live data was unavailable and the result (possibly empty) came from cache/DB history instead — the frontend surfaces this instead of pretending everything's fine. */
  warning?: "no_live_data" | "showing_cached" | "refresh_failed_showing_cached";
}

let cached: { at: number; result: TrendEngineResult } | null = null;
const ENGINE_CACHE_TTL_MS = CACHE_TTL_MS.default;

function extractHttpCode(err: unknown): number | undefined {
  const m = /(\d{3})/.exec(String((err as any)?.message ?? ""));
  return m ? Number(m[1]) : undefined;
}

/**
 * Calls every enabled provider, isolated (one failing never blocks the
 * others), respecting each provider's backoff window so a provider that
 * just failed isn't hammered again on the very next request.
 */
async function runProviders(): Promise<{ anyAttempted: boolean; anySucceeded: boolean }> {
  let anyAttempted = false;
  let anySucceeded = false;

  await Promise.all(
    ALL_PROVIDERS.map(async (provider) => {
      if (!provider.enabled) {
        recordNotConfigured(provider.id, provider.name, provider.disabledReason);
        return;
      }
      if (isBackedOff(provider.id)) return;

      anyAttempted = true;
      recordAttempt(provider.id, provider.name);
      const start = Date.now();
      try {
        const articles = await provider.fetch();
        upsertArticles(articles);
        recordSuccess(provider.id, provider.name, articles.length, Date.now() - start);
        anySucceeded = true;
      } catch (err) {
        recordFailure(provider.id, provider.name, err, extractHttpCode(err));
      }
    })
  );

  return { anyAttempted, anySucceeded };
}

/** Fetches fresh data from every provider, then re-clusters/re-scores the full recent-article window (which includes this run's new articles plus everything still-recent from before). */
export async function refreshTrends(): Promise<TrendEngineResult> {
  const { anyAttempted, anySucceeded } = await runProviders();
  cleanupOldArticles();

  const recentArticles = getRecentArticles(MAX_ARTICLE_AGE_HOURS);
  const now = new Date();
  const trends = clusterArticles(recentArticles)
    .map((c) => scoreCluster(c, now))
    .sort((a, b) => b.score - a.score);

  const result: TrendEngineResult = {
    trends,
    generatedAt: now.toISOString(),
    sourceHealth: getAllHealth(),
  };
  if (anyAttempted && !anySucceeded) {
    result.warning = trends.length > 0 ? "showing_cached" : "no_live_data";
  }

  cached = { at: Date.now(), result };
  return result;
}

/**
 * Cached read with background-refresh semantics: a request within the TTL
 * gets the cached list immediately; once stale, it triggers a real
 * refresh. If the refresh itself throws (shouldn't, since every provider
 * and DB call is already isolated, but defense in depth), fall back to
 * whatever's cached rather than surfacing a 500 to the dashboard.
 */
export async function getTrends(forceRefresh = false): Promise<TrendEngineResult> {
  if (!forceRefresh && cached && Date.now() - cached.at < ENGINE_CACHE_TTL_MS) {
    return cached.result;
  }
  try {
    return await refreshTrends();
  } catch (err) {
    console.error("[TrendEngine] refresh failed unexpectedly:", err);
    if (cached) return { ...cached.result, warning: "refresh_failed_showing_cached" };
    return { trends: [], generatedAt: new Date().toISOString(), sourceHealth: getAllHealth(), warning: "no_live_data" };
  }
}

// --- Per-country (map/picker) trend fetching -------------------------------
//
// The default getTrends()/refreshTrends() above stay Morocco-and-world
// scoped (the app's home dashboard, unchanged). This section adds an
// independent path -- its own cache keyed by country code, its own
// providers (Google News + GDELT scoped to that one country's generic
// query group), and its own relevance scoring (the selected country's name,
// not always Morocco's) -- so picking a different country on the map never
// touches or gets mixed up with the Morocco-focused default feed.

const countryCache = new Map<string, { at: number; result: TrendEngineResult }>();

async function runCountryProviders(country: Country): Promise<{ anyAttempted: boolean; anySucceeded: boolean }> {
  const jobs: { id: string; name: string; run: () => Promise<RawArticle[]> }[] = [
    { id: `google_news:${country.code}`, name: `Google News (${country.name})`, run: () => fetchGoogleNewsForCountry(country) },
    { id: `gdelt:${country.code}`, name: `GDELT (${country.name})`, run: () => fetchGdeltForCountry(country) },
  ];

  let anyAttempted = false;
  let anySucceeded = false;

  await Promise.all(
    jobs.map(async (job) => {
      if (isBackedOff(job.id)) return;
      anyAttempted = true;
      recordAttempt(job.id, job.name);
      const start = Date.now();
      try {
        const articles = await job.run();
        upsertArticles(articles);
        recordSuccess(job.id, job.name, articles.length, Date.now() - start);
        anySucceeded = true;
      } catch (err) {
        recordFailure(job.id, job.name, err, extractHttpCode(err));
      }
    })
  );

  return { anyAttempted, anySucceeded };
}

export async function refreshTrendsForCountry(country: Country): Promise<TrendEngineResult> {
  const { anyAttempted, anySucceeded } = await runCountryProviders(country);
  cleanupOldArticles();

  // Scoped to articles actually tagged with this country -- clustering only
  // ever mixes stories that are about the same selected country, never
  // accidentally merges two different countries' generic "news today"
  // queries just because the wording happens to overlap.
  const recentArticles = getRecentArticles(MAX_ARTICLE_AGE_HOURS).filter((a) => a.country === country.code);
  const now = new Date();
  const relevance = { high: new RegExp(escapeRegExp(country.name), "i") };
  const trends = clusterArticles(recentArticles)
    .map((c) => scoreCluster(c, now, relevance))
    .sort((a, b) => b.score - a.score);

  const result: TrendEngineResult = {
    trends,
    generatedAt: now.toISOString(),
    sourceHealth: getAllHealth().filter((h) => h.id.endsWith(`:${country.code}`)),
  };
  if (anyAttempted && !anySucceeded) {
    result.warning = trends.length > 0 ? "showing_cached" : "no_live_data";
  }

  countryCache.set(country.code, { at: Date.now(), result });
  return result;
}

export async function getTrendsForCountry(country: Country, forceRefresh = false): Promise<TrendEngineResult> {
  const entry = countryCache.get(country.code);
  if (!forceRefresh && entry && Date.now() - entry.at < ENGINE_CACHE_TTL_MS) {
    return entry.result;
  }
  try {
    return await refreshTrendsForCountry(country);
  } catch (err) {
    console.error(`[TrendEngine] country refresh failed for ${country.code}:`, err);
    if (entry) return { ...entry.result, warning: "refresh_failed_showing_cached" };
    return {
      trends: [],
      generatedAt: new Date().toISOString(),
      sourceHealth: getAllHealth().filter((h) => h.id.endsWith(`:${country.code}`)),
      warning: "no_live_data",
    };
  }
}
