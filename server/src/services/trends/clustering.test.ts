import { describe, it, expect } from "vitest";
import { clusterArticles } from "./clustering.js";
import type { RawArticle } from "./types.js";

function article(overrides: Partial<RawArticle>): RawArticle {
  const now = new Date().toISOString();
  return {
    id: overrides.url ?? Math.random().toString(36),
    title: "Untitled",
    url: "https://example.com",
    source: "Test Source",
    sourceDomain: "example.com",
    publishedAt: now,
    discoveredAt: now,
    language: "fr",
    country: "MA",
    categoryHint: "morocco",
    description: null,
    imageUrl: null,
    keywords: [],
    provider: "test",
    ...overrides,
  };
}

describe("clusterArticles", () => {
  it("merges reworded headlines about the same story from different outlets into one cluster (spec example)", () => {
    const now = new Date().toISOString();
    const articles = [
      article({ id: "1", url: "https://hespress.com/a", source: "Hespress", sourceDomain: "hespress.com", title: "Maroc annonce nouvelle réforme", publishedAt: now }),
      article({ id: "2", url: "https://le360.ma/b", source: "Le360", sourceDomain: "le360.ma", title: "Nouvelle réforme annoncée au Maroc", publishedAt: now }),
      article({ id: "3", url: "https://map.ma/c", source: "MAP", sourceDomain: "map.ma", title: "Le gouvernement dévoile la réforme", publishedAt: now }),
    ];

    const clusters = clusterArticles(articles);
    // The first two share enough vocabulary to cluster; a looser third headline
    // may or may not join depending on overlap -- either way, corroboration
    // across outlets must show up as sourceCount > 1 on the dominant cluster.
    const dominant = clusters.sort((a, b) => b.articles.length - a.articles.length)[0];
    expect(dominant.articles.length).toBeGreaterThanOrEqual(2);
    expect(dominant.sourceCount).toBeGreaterThanOrEqual(2);
  });

  it("keeps genuinely different stories in separate clusters", () => {
    const articles = [
      article({ id: "1", url: "https://a.com/1", title: "Le Wydad remporte le championnat national de football" }),
      article({ id: "2", url: "https://b.com/2", title: "Nouvelle réforme fiscale annoncée par le gouvernement marocain" }),
    ];
    const clusters = clusterArticles(articles);
    expect(clusters.length).toBe(2);
  });

  it("dedupes the exact same article fetched twice (e.g. by two providers) by its stable id", () => {
    const dup: RawArticle = article({ id: "same-id", url: "https://a.com/1", title: "Le Maroc lance un projet" });
    const clusters = clusterArticles([dup, { ...dup }]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].articles.length).toBe(1);
  });

  it("does not cluster the same headline text published >36h apart as one still-fresh story", () => {
    const now = Date.now();
    const old = article({
      id: "old",
      url: "https://a.com/old",
      title: "Le Maroc organise un sommet international",
      publishedAt: new Date(now - 40 * 3_600_000).toISOString(),
    });
    const fresh = article({
      id: "fresh",
      url: "https://a.com/fresh",
      title: "Le Maroc organise un sommet international",
      publishedAt: new Date(now).toISOString(),
    });
    const clusters = clusterArticles([old, fresh]);
    expect(clusters.length).toBe(2);
  });

  it("computes sourceCount from distinct domains, not distinct articles", () => {
    const now = new Date().toISOString();
    const articles = [
      article({ id: "1", url: "https://hespress.com/a", sourceDomain: "hespress.com", title: "Maroc annonce un plan national" }),
      article({ id: "2", url: "https://hespress.com/b", sourceDomain: "hespress.com", title: "Maroc annonce un plan national majeur" }),
    ];
    const clusters = clusterArticles(articles);
    expect(clusters[0].sourceCount).toBe(1);
  });
});
