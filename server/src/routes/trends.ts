import { Router } from "express";
import { getTrends, refreshTrends, getTrendsForCountry, refreshTrendsForCountry } from "../services/trends/engine.js";
import { toNormalizedTrend } from "../services/trends/trendMapper.js";
import { COUNTRIES, getCountry } from "../services/trends/countries.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { TrendEngineResult } from "../services/trends/engine.js";

export const trendsRouter = Router();

/**
 * GET /api/trends/countries
 * The full list the map/country picker renders from — every country the
 * engine can fetch on demand, each with its ISO alpha-2 code (what to pass
 * back as ?country=) and the exact name the client's world-atlas map uses,
 * so map clicks and this list always agree on identity.
 */
trendsRouter.get("/countries", (_req, res) => {
  res.json({
    countries: COUNTRIES.map((c) => ({ code: c.code, name: c.name, mapName: c.mapName, language: c.language })),
  });
});

function resolveCountryFetch(countryParam: string | undefined, forceRefresh: boolean): Promise<TrendEngineResult> {
  // No country, or explicitly Morocco -> the default Morocco-and-world home dashboard (unchanged).
  if (!countryParam || countryParam === "MA") return getTrends(forceRefresh);

  const country = getCountry(countryParam);
  if (!country) {
    // An unrecognized code shouldn't 500 -- just fall back to the default feed rather than erroring the whole dashboard.
    return getTrends(forceRefresh);
  }
  return getTrendsForCountry(country, forceRefresh);
}

/**
 * GET /api/trends
 * Ranked "best stories to post" — combined across every enabled provider
 * (Google News, GDELT, publisher RSS, optionally Reddit), clustered so the
 * same story from multiple outlets counts once, and scored 0-100.
 *
 * Query params: country (ISO alpha-2, from the map/picker — defaults to
 * Morocco), language, category, limit, minScore, hours, status,
 * refresh=1 (bypass the cache and fetch live now).
 */
trendsRouter.get("/", asyncHandler(async (req, res) => {
  const forceRefresh = req.query.refresh === "1";
  const limit = Math.min(100, Number(req.query.limit) || 40);
  const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : undefined;
  const hours = req.query.hours !== undefined ? Number(req.query.hours) : undefined;
  const countryParam = typeof req.query.country === "string" ? req.query.country.toUpperCase() : undefined;
  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;

  const { trends, generatedAt, sourceHealth, warning } = await resolveCountryFetch(countryParam, forceRefresh);

  let filtered = trends;
  if (minScore !== undefined) filtered = filtered.filter((t) => t.score >= minScore);
  if (hours !== undefined) filtered = filtered.filter((t) => t.ageMinutes <= hours * 60);
  if (language) filtered = filtered.filter((t) => t.language === language);
  if (category) filtered = filtered.filter((t) => t.categoryKey === category);
  if (status) filtered = filtered.filter((t) => t.trendType === status);

  res.json({
    trends: filtered.slice(0, limit).map(toNormalizedTrend),
    generatedAt,
    sources: sourceHealth.map((h) => h.name),
    sourceHealth,
    country: countryParam && getCountry(countryParam) ? countryParam : "MA",
    ...(warning ? { warning } : {}),
  });
}));

/**
 * GET /api/trends/:id
 * Full detail for one trend: every supporting article, source list, and
 * the score breakdown (spec: "This makes the ranking explainable"). Pass
 * ?country= if the trend came from a country-scoped fetch — its cluster
 * only lives in that country's cache, not the default Morocco one.
 */
trendsRouter.get("/:id", asyncHandler(async (req, res) => {
  const countryParam = typeof req.query.country === "string" ? req.query.country.toUpperCase() : undefined;
  const { trends } = await resolveCountryFetch(countryParam, false);
  const cluster = trends.find((t) => t.id === req.params.id);
  if (!cluster) return res.status(404).json({ error: "Trend not found (it may have aged out or been re-clustered on the last refresh)" });

  res.json({
    trend: toNormalizedTrend(cluster),
    articles: cluster.articles,
    sources: cluster.sources,
    scoreBreakdown: cluster.scoreBreakdown,
  });
}));

/**
 * POST /api/trends/refresh
 * Manually triggers a live refresh, bypassing the cache. Body/query
 * ?country= scopes it to one country's providers instead of the default feed.
 */
trendsRouter.post("/refresh", asyncHandler(async (req, res) => {
  const countryParam = typeof req.query.country === "string" ? req.query.country.toUpperCase() : undefined;
  const country = countryParam && countryParam !== "MA" ? getCountry(countryParam) : undefined;

  const { trends, generatedAt, sourceHealth, warning } = country ? await refreshTrendsForCountry(country) : await refreshTrends();
  res.json({
    trends: trends.slice(0, 60).map(toNormalizedTrend),
    generatedAt,
    sources: sourceHealth.map((h) => h.name),
    sourceHealth,
    country: country?.code ?? "MA",
    ...(warning ? { warning } : {}),
  });
}));
