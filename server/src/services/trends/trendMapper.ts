import type { NormalizedTrend, TrendCluster } from "./types.js";

function scoreExplanation(cluster: TrendCluster): string {
  const typeLabel: Record<TrendCluster["trendType"], string> = {
    BREAKING: "🔥 Breaking",
    RISING: "📈 Rising fast",
    VIRAL: "🚀 Viral",
    POPULAR: "👥 Popular",
    STABLE: "📰 Ongoing",
  };
  const ageLabel = cluster.ageMinutes < 60 ? `${cluster.ageMinutes}min ago` : `${Math.round(cluster.ageMinutes / 60)}h ago`;
  const sourceLabel = cluster.sourceCount === 1 ? "1 source" : `${cluster.sourceCount} sources`;
  return `${typeLabel[cluster.trendType]} · ${sourceLabel} · ${ageLabel}`;
}

/**
 * Flattens a TrendCluster into the shape the rest of the app already
 * consumes (AutoPost, RenderPanel, the caption generator) — those don't
 * need to know about clusters/articles, just "one trend to post about".
 * New fields are additive so nothing that reads only the original ones
 * breaks.
 */
export function toNormalizedTrend(cluster: TrendCluster): NormalizedTrend {
  const representative = cluster.articles.find((a) => a.title === cluster.title) ?? cluster.articles[0];
  const displaySource =
    cluster.sources.length <= 2
      ? cluster.sources.join(" + ")
      : `${cluster.sources[0]} +${cluster.sources.length - 1}`;

  return {
    id: cluster.id,
    source: displaySource || "Unknown",
    title: cluster.title,
    url: representative?.url ?? "",
    imageUrl: cluster.imageUrl,
    publishedAt: cluster.publishedAt,
    language: cluster.language,
    category: cluster.categoryKey,
    score: cluster.score,
    scoreExplanation: scoreExplanation(cluster),
    summary: cluster.description,
    sourceCount: cluster.sourceCount,
    sources: cluster.sources,
    trendType: cluster.trendType,
    categoryEmoji: cluster.categoryEmoji,
    ageMinutes: cluster.ageMinutes,
    velocityPerHour: cluster.velocityPerHour,
    scoreBreakdown: cluster.scoreBreakdown,
    articleCount: cluster.articles.length,
  };
}
