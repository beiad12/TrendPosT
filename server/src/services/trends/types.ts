// Core trend-engine types, shared across providers, clustering, scoring, and routes.

export type ProviderStatusValue = "healthy" | "degraded" | "unavailable" | "not_configured";

/** A single article/post as fetched from one provider, before clustering. */
export interface RawArticle {
  id: string;
  title: string;
  url: string;
  /** Human-readable outlet/source label, e.g. "Hespress (FR)" or "Google News". */
  source: string;
  sourceDomain: string;
  publishedAt: string | null;
  /** When *this server* first saw the article — the basis for velocity tracking. */
  discoveredAt: string;
  language: string;
  country: string;
  /** Raw category hint from the provider (RSS <category>, search query group, etc.) — informational, not the final classified category. */
  categoryHint: string;
  description: string | null;
  imageUrl: string | null;
  keywords: string[];
  /** Which provider produced this article, e.g. "google_news", "gdelt", "publisher_rss:hespress-fr". */
  provider: string;
}

export interface ScoreBreakdown {
  freshness: number;
  sourceCount: number;
  velocity: number;
  moroccoRelevance: number;
  social: number;
  category: number;
  viralPotential: number;
  total: number;
}

export type TrendType = "BREAKING" | "RISING" | "VIRAL" | "POPULAR" | "STABLE";

/** Multiple articles about the same real-world story, merged into one trend. */
export interface TrendCluster {
  id: string;
  title: string;
  articles: RawArticle[];
  sourceCount: number;
  sources: string[];
  language: string;
  categoryKey: string;
  categoryLabel: string;
  categoryEmoji: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  trendType: TrendType;
  ageMinutes: number;
  velocityPerHour: number;
}

/**
 * Flattened shape the rest of the app (AutoPost, RenderPanel, the existing
 * Dashboard/TrendDetailModal) already consumes — kept so the caption
 * generator and post renderer don't need to change. New fields are
 * additive; a consumer reading only the original fields still works.
 */
export interface NormalizedTrend {
  id: string;
  source: string;
  title: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  language: string;
  category: string;
  score: number;
  scoreExplanation: string;
  summary: string | null;
  sourceCount: number;
  sources: string[];
  trendType: TrendType;
  categoryEmoji: string;
  ageMinutes: number;
  velocityPerHour: number;
  scoreBreakdown: ScoreBreakdown;
  articleCount: number;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: ProviderStatusValue;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastAttempt: string | null;
  errorCount: number;
  latencyMs: number | null;
  itemsFetched: number;
  lastError: string | null;
  nextRetryAt: string | null;
}
