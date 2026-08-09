import { PROVIDERS_CONFIG } from "../config.js";
import type { RawArticle } from "../types.js";
import type { TrendProvider } from "./types.js";

/**
 * Google's old "trendingsearches/daily/rss" endpoint this project used to
 * call is gone (404) — Google discontinued the free public daily-trends
 * RSS. There is no other free, no-key endpoint that provides the same
 * data, and this project does not fabricate trend data to fill the gap.
 *
 * This provider is disabled by default (see config.ts PROVIDERS_CONFIG) and
 * always reports `not_configured` — the aggregator skips calling `fetch()`
 * entirely for a disabled provider, so it never contributes a 404. If you
 * later get access to a real Google Trends API (e.g. via a paid/partner
 * integration), wire the real call into `fetch()` here and flip
 * `PROVIDERS_CONFIG.googleTrends.enabled` — the rest of the pipeline
 * (health, caching, scoring) doesn't need to change.
 */
export const googleTrendsProvider: TrendProvider = {
  id: "google_trends",
  name: "Google Trends",
  type: "api",
  enabled: PROVIDERS_CONFIG.googleTrends.enabled,
  disabledReason: PROVIDERS_CONFIG.googleTrends.reason,
  async fetch(): Promise<RawArticle[]> {
    throw new Error("Google Trends provider has no working free endpoint — left disabled, not faked");
  },
};
