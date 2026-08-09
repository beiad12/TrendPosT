import { Router } from "express";
import { fetchAllTrends } from "../services/trends/rssService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const trendsRouter = Router();

let cache: { fetchedAt: number; data: Awaited<ReturnType<typeof fetchAllTrends>> } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — avoid hammering source feeds

/**
 * GET /api/trends
 * Returns Moroccan trending topics ranked by virality score.
 * Query params: ?refresh=1 to bypass cache, ?limit=N
 */
trendsRouter.get("/", asyncHandler(async (req, res) => {
  const forceRefresh = req.query.refresh === "1";
  const limit = Math.min(100, Number(req.query.limit) || 40);

  try {
    if (!cache || forceRefresh || Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
      const data = await fetchAllTrends();
      cache = { fetchedAt: Date.now(), data };
    }
    res.json({ fetchedAt: new Date(cache.fetchedAt).toISOString(), trends: cache.data.slice(0, limit) });
  } catch (err: any) {
    res.status(502).json({ error: "Failed to fetch trends", detail: err?.message });
  }
}));
