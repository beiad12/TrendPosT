import { db } from "../../db/index.js";
import { ARTICLE_RETENTION_HOURS } from "./config.js";
import type { RawArticle } from "./types.js";

/**
 * Upserts fetched articles into trend_articles. Deliberately `INSERT OR
 * IGNORE` on the primary key (a hash of the cleaned URL) — an article
 * that's already stored keeps its *original* discovered_at, which is what
 * makes velocity a real measurement of "when did this first show up"
 * across fetch cycles instead of getting reset to "now" every refresh.
 */
export function upsertArticles(articles: RawArticle[]): void {
  if (articles.length === 0) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO trend_articles
      (id, title, url, source, source_domain, published_at, discovered_at, language, country, category_hint, description, image_url, keywords_json, provider)
     VALUES (@id, @title, @url, @source, @source_domain, @published_at, @discovered_at, @language, @country, @category_hint, @description, @image_url, @keywords_json, @provider)`
  );
  for (const a of articles) {
    stmt.run({
      id: a.id,
      title: a.title,
      url: a.url,
      source: a.source,
      source_domain: a.sourceDomain,
      published_at: a.publishedAt,
      discovered_at: a.discoveredAt,
      language: a.language,
      country: a.country,
      category_hint: a.categoryHint,
      description: a.description,
      image_url: a.imageUrl,
      keywords_json: JSON.stringify(a.keywords ?? []),
      provider: a.provider,
    });
  }
}

function rowToArticle(row: any): RawArticle {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    sourceDomain: row.source_domain,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    language: row.language,
    country: row.country,
    categoryHint: row.category_hint,
    description: row.description,
    imageUrl: row.image_url,
    keywords: JSON.parse(row.keywords_json || "[]"),
    provider: row.provider,
  };
}

/** All articles discovered or published within the last `maxAgeHours` — the working set clustering/scoring runs over on every request. */
export function getRecentArticles(maxAgeHours: number): RawArticle[] {
  const rows = db
    .prepare(
      `SELECT * FROM trend_articles
       WHERE discovered_at >= datetime('now', ?) OR published_at >= datetime('now', ?)
       ORDER BY discovered_at DESC`
    )
    .all(`-${maxAgeHours} hours`, `-${maxAgeHours} hours`);
  return rows.map(rowToArticle);
}

/** Deletes articles older than the retention window so the table doesn't grow unbounded. */
export function cleanupOldArticles(retentionHours: number = ARTICLE_RETENTION_HOURS): number {
  const result = db
    .prepare(`DELETE FROM trend_articles WHERE discovered_at < datetime('now', ?)`)
    .run(`-${retentionHours} hours`);
  return Number(result.changes ?? 0);
}
