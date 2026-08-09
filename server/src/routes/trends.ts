import { Router } from "express";
import { getTrends, refreshTrends } from "../services/trends/engine.js";
import { toNormalizedTrend } from "../services/trends/trendMapper.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const trendsRouter = Router();

/**
 * GET /api/trends
 * Ranked "best stories to post" — combined across every enabled provider
 * (Google News, GDELT, publisher RSS, optionally Reddit), clustered so the
 * same story from multiple outlets counts once, and scored 0-100.
 *
 * Query params: country, language, category, limit, minScore, hours, status,
 * refresh=1 (bypass the cache and fetch live now).
 */
trendsRouter.get("/", asyncHandler(async (req, res) => {
  const forceRefresh = req.query.refresh === "1";
  const limit = Math.min(100, Number(req.query.limit) || 40);
  const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : undefined;
  const hours = req.query.hours !== undefined ? Number(req.query.hours) : undefined;
  const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : undefined;
  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;

  const { trends, generatedAt, sourceHealth, warning } = await getTrends(forceRefresh);

  let filtered = trends;
  if (minScore !== undefined) filtered = filtered.filter((t) => t.score >= minScore);
  if (hours !== undefined) filtered = filtered.filter((t) => t.ageMinutes <= hours * 60);
  if (language) filtered = filtered.filter((t) => t.language === language);
  if (category) filtered = filtered.filter((t) => t.categoryKey === category);
  if (status) filtered = filtered.filter((t) => t.trendType === status);
  if (country) filtered = filtered.filter((t) => t.articles.some((a) => a.country === country));

  res.json({
    trends: filtered.slice(0, limit).map(toNormalizedTrend),
    generatedAt,
    sources: sourceHealth.map((h) => h.name),
    sourceHealth,
    ...(warning ? { warning } : {}),
  });
}));

/**
 * GET /api/trends/:id
 * Full detail for one trend: every supporting article, source list, and
 * the score breakdown (spec: "This makes the ranking explainable").
 */
trendsRouter.get("/:id", asyncHandler(async (req, res) => {
  const { trends } = await getTrends(false);
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
 * Manually triggers a live refresh across all providers, bypassing the cache.
 */
trendsRouter.post("/refresh", asyncHandler(async (_req, res) => {
  const { trends, generatedAt, sourceHealth, warning } = await refreshTrends();
  res.json({
    trends: trends.slice(0, 60).map(toNormalizedTrend),
    generatedAt,
    sources: sourceHealth.map((h) => h.name),
    sourceHealth,
    ...(warning ? { warning } : {}),
  });
}));
