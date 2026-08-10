import {
  CATEGORIES,
  MOROCCO_HIGH_RELEVANCE,
  MOROCCO_MEDIUM_RELEVANCE,
  SCORE_WEIGHTS,
  VIRAL_SIGNALS,
} from "./config.js";
import type { UnscoredCluster } from "./clustering.js";
import type { ScoreBreakdown, TrendCluster, TrendType } from "./types.js";

/** Freshness decay curve (spec §13) — recency measured from the earliest known publish time, falling back to discovery time. */
function freshnessFactor(ageMinutes: number, isAccelerating: boolean): number {
  if (ageMinutes < 30) return 1.0;
  if (ageMinutes < 60) return 0.9;
  if (ageMinutes < 180) return 0.75;
  if (ageMinutes < 360) return 0.55;
  if (ageMinutes < 720) return 0.35;
  if (ageMinutes < 1440) return 0.15;
  return isAccelerating ? 0.08 : 0; // older than 24h: excluded from meaningful scoring unless still actively accelerating
}

/** More independent outlets/platforms carrying the same story = a stronger, more corroborated signal (spec §14). Domains are already deduped by clustering.ts. */
function sourceCountFactor(sourceCount: number): number {
  if (sourceCount <= 1) return 0.25;
  if (sourceCount === 2) return 0.5;
  if (sourceCount <= 4) return 0.8;
  return 1.0;
}

/**
 * How quickly new coverage is appearing (spec §15) — computed from real
 * `discoveredAt` timestamps accumulated across fetch cycles (see
 * articleStore.ts), not just a single snapshot's article count. On a
 * freshly-seeded database every article looks "brand new" (no prior-hour
 * baseline yet) — that's an honest cold-start, not a fabricated number; it
 * self-corrects as more fetch cycles accumulate real history.
 */
function velocity(articles: { discoveredAt: string }[], now: number): { velocityPerHour: number; factor: number } {
  const lastHour = articles.filter((a) => now - new Date(a.discoveredAt).getTime() <= 3_600_000).length;
  const priorHour = articles.filter((a) => {
    const age = now - new Date(a.discoveredAt).getTime();
    return age > 3_600_000 && age <= 7_200_000;
  }).length;

  const growthRatio = priorHour === 0 ? (lastHour > 0 ? 2 : 0) : lastHour / priorHour;
  const factor = Math.max(0, Math.min(1, lastHour / 6 + Math.max(0, growthRatio - 1) * 0.25));
  return { velocityPerHour: lastHour, factor };
}

export interface RelevanceKeywords {
  high: RegExp;
  medium?: RegExp;
}

const DEFAULT_RELEVANCE: RelevanceKeywords = { high: MOROCCO_HIGH_RELEVANCE, medium: MOROCCO_MEDIUM_RELEVANCE };

function relevanceFactor(text: string, relevance: RelevanceKeywords): number {
  if (relevance.high.test(text)) return 1.0;
  if (relevance.medium?.test(text)) return 0.5;
  return 0.15;
}

/** Escapes regex special characters so a country name can be dropped straight into a RegExp. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * No real Facebook/social engagement API is wired up (would require Page
 * Insights access this project doesn't have) — as an honest proxy, a
 * story already validated by Reddit's own "hot" ranking counts for
 * something; everything else gets a conservative baseline rather than a
 * fabricated number.
 */
function socialFactor(articles: { provider: string }[]): number {
  return articles.some((a) => a.provider.startsWith("reddit:")) ? 1.0 : 0.3;
}

function classifyCategory(text: string) {
  for (const cat of CATEGORIES) {
    if (cat.key === "morocco") continue; // catch-all, checked last
    if (cat.keywords.test(text)) return cat;
  }
  return CATEGORIES.find((c) => c.key === "morocco")!;
}

function viralPotentialFactor(text: string): number {
  let hit = 0;
  for (const signal of VIRAL_SIGNALS) {
    if (signal.words.test(text)) hit += signal.weight;
  }
  return Math.min(1, hit / 20); // 20 = roughly two strong signals firing together
}

function classifyTrendType(ageMinutes: number, sourceCount: number, velocityPerHour: number, totalScore: number): TrendType {
  if (ageMinutes <= 60 && velocityPerHour >= 3) return "BREAKING";
  if (totalScore >= 75) return "VIRAL";
  if (velocityPerHour >= 2) return "RISING";
  if (sourceCount >= 3) return "POPULAR";
  return "STABLE";
}

/**
 * Scores a story cluster 0-100 across the weighted factors in
 * config.ts#SCORE_WEIGHTS, classifies its category and trend type, and
 * returns the fully-formed TrendCluster the rest of the app consumes.
 *
 * `relevance` defaults to Morocco's curated keyword set (the app's home
 * dashboard); the per-country map/picker passes a keyword built from the
 * selected country's own name instead, so "relevance" always means
 * "relevant to whichever place this fetch was actually about", not always
 * literally Morocco.
 */
export function scoreCluster(cluster: UnscoredCluster, now: Date = new Date(), relevance: RelevanceKeywords = DEFAULT_RELEVANCE): TrendCluster {
  const nowMs = now.getTime();
  const text = `${cluster.title} ${cluster.description ?? ""}`;

  const referenceTime = cluster.publishedAt ?? cluster.discoveredAt;
  const ageMinutes = Math.max(0, (nowMs - new Date(referenceTime).getTime()) / 60_000);

  const { velocityPerHour, factor: velocityFactorValue } = velocity(cluster.articles, nowMs);
  const isAccelerating = velocityFactorValue > 0.5;

  const category = classifyCategory(text);

  const breakdown: ScoreBreakdown = {
    freshness: Math.round(freshnessFactor(ageMinutes, isAccelerating) * SCORE_WEIGHTS.freshness),
    sourceCount: Math.round(sourceCountFactor(cluster.sourceCount) * SCORE_WEIGHTS.sourceCount),
    velocity: Math.round(velocityFactorValue * SCORE_WEIGHTS.velocity),
    moroccoRelevance: Math.round(relevanceFactor(text, relevance) * SCORE_WEIGHTS.moroccoRelevance),
    social: Math.round(socialFactor(cluster.articles) * SCORE_WEIGHTS.social),
    category: Math.round(category.importance * SCORE_WEIGHTS.category),
    viralPotential: Math.round(viralPotentialFactor(text) * SCORE_WEIGHTS.viralPotential),
    total: 0,
  };
  breakdown.total = Math.min(
    100,
    breakdown.freshness + breakdown.sourceCount + breakdown.velocity + breakdown.moroccoRelevance + breakdown.social + breakdown.category + breakdown.viralPotential
  );

  const trendType = classifyTrendType(ageMinutes, cluster.sourceCount, velocityPerHour, breakdown.total);

  return {
    ...cluster,
    categoryKey: category.key,
    categoryLabel: category.label,
    categoryEmoji: category.emoji,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    trendType,
    ageMinutes: Math.round(ageMinutes),
    velocityPerHour,
  };
}
