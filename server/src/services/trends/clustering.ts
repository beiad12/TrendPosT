import { randomUUID } from "node:crypto";
import { jaccardSimilarity, titleTokens } from "./normalize.js";
import type { RawArticle, TrendCluster } from "./types.js";

const SIMILARITY_THRESHOLD = 0.32;
const CLUSTER_TIME_WINDOW_HOURS = 36;

/** Everything clustering.ts can determine before scoring/classification runs. */
export type UnscoredCluster = Omit<
  TrendCluster,
  "score" | "scoreBreakdown" | "trendType" | "ageMinutes" | "velocityPerHour" | "categoryKey" | "categoryLabel" | "categoryEmoji"
>;

function dedupeByUrl(articles: RawArticle[]): RawArticle[] {
  const seen = new Map<string, RawArticle>();
  for (const a of articles) {
    if (!a.title?.trim() || !a.url) continue;
    if (!seen.has(a.id)) seen.set(a.id, a);
  }
  return [...seen.values()];
}

interface WorkingCluster {
  articles: RawArticle[];
  memberTokens: Set<string>[];
  earliestTimeMs: number;
}

function articleTimeMs(a: RawArticle): number {
  const t = a.publishedAt ?? a.discoveredAt;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

/**
 * Groups articles about the same real-world story into one cluster.
 * Single-linkage: a new article joins the first existing cluster where it
 * scores above the similarity threshold against *any* existing member
 * (not the cluster's ever-growing token union, which would let clusters
 * drift and merge unrelated stories over time) and falls within the
 * clustering time window of that cluster.
 */
export function clusterArticles(rawArticles: RawArticle[]): UnscoredCluster[] {
  const articles = dedupeByUrl(rawArticles);
  const clusters: WorkingCluster[] = [];

  for (const article of articles) {
    const tokens = titleTokens(article.title);
    const t = articleTimeMs(article);

    let best: WorkingCluster | null = null;
    let bestSim = 0;
    for (const cluster of clusters) {
      const hoursApart = Math.abs(t - cluster.earliestTimeMs) / 3_600_000;
      if (hoursApart > CLUSTER_TIME_WINDOW_HOURS) continue;
      for (const memberTokens of cluster.memberTokens) {
        const sim = jaccardSimilarity(tokens, memberTokens);
        if (sim > bestSim) {
          bestSim = sim;
          best = cluster;
        }
      }
    }

    if (best && bestSim >= SIMILARITY_THRESHOLD) {
      best.articles.push(article);
      best.memberTokens.push(tokens);
      best.earliestTimeMs = Math.min(best.earliestTimeMs, t);
    } else {
      clusters.push({ articles: [article], memberTokens: [tokens], earliestTimeMs: t });
    }
  }

  return clusters.map(toUnscoredCluster);
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function toUnscoredCluster(cluster: WorkingCluster): UnscoredCluster {
  const { articles } = cluster;
  // Representative headline: the longest title reads as the most complete/descriptive one.
  const representative = [...articles].sort((a, b) => b.title.length - a.title.length)[0];

  const sourceDomains = new Set(articles.map((a) => a.sourceDomain).filter(Boolean));
  const sources = [...new Set(articles.map((a) => a.source).filter(Boolean))];
  const language = mostCommon(articles.map((a) => a.language)) ?? articles[0].language;

  const publishedTimes = articles.map((a) => a.publishedAt).filter((p): p is string => !!p);
  const publishedAt = publishedTimes.length ? new Date(Math.min(...publishedTimes.map((p) => new Date(p).getTime()))).toISOString() : null;
  const discoveredAt = new Date(Math.min(...articles.map((a) => new Date(a.discoveredAt).getTime()))).toISOString();

  return {
    id: randomUUID(),
    title: representative.title,
    articles,
    sourceCount: sourceDomains.size || sources.length,
    sources,
    language,
    description: articles.find((a) => a.description)?.description ?? null,
    imageUrl: articles.find((a) => a.imageUrl)?.imageUrl ?? null,
    publishedAt,
    discoveredAt,
  };
}
