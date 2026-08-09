import { ALL_PROVIDERS } from "./providers/index.js";
import { upsertArticles, getRecentArticles, cleanupOldArticles } from "./articleStore.js";
import { clusterArticles } from "./clustering.js";
import { scoreCluster } from "./scoring.js";
import { recordAttempt, recordSuccess, recordFailure, recordNotConfigured, isBackedOff, getAllHealth } from "./sourceHealth.js";
import { CACHE_TTL_MS, MAX_ARTICLE_AGE_HOURS } from "./config.js";
import type { ProviderHealth, TrendCluster } from "./types.js";

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
