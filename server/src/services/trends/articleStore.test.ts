import { describe, it, expect } from "vitest";
import { upsertArticles, getRecentArticles, cleanupOldArticles } from "./articleStore.js";
import type { RawArticle } from "./types.js";

function article(overrides: Partial<RawArticle>): RawArticle {
  const now = new Date().toISOString();
  return {
    id: Math.random().toString(36),
    title: "Untitled",
    url: "https://example.com",
    source: "Test",
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

describe("articleStore", () => {
  it("round-trips an article through upsert + getRecentArticles", () => {
    const a = article({ id: "store-test-1", title: "A story worth keeping" });
    upsertArticles([a]);
    const recent = getRecentArticles(48);
    expect(recent.some((r) => r.id === "store-test-1" && r.title === "A story worth keeping")).toBe(true);
  });

  it("keeps the original discoveredAt on a duplicate id — this is what makes velocity real", () => {
    const originalTime = new Date(Date.now() - 3_600_000).toISOString();
    upsertArticles([article({ id: "store-test-2", discoveredAt: originalTime })]);
    // Same id, "refetched" with a newer discoveredAt -- INSERT OR IGNORE must keep the original.
    upsertArticles([article({ id: "store-test-2", discoveredAt: new Date().toISOString() })]);

    const recent = getRecentArticles(48);
    const stored = recent.find((r) => r.id === "store-test-2")!;
    expect(stored.discoveredAt).toBe(originalTime);
  });

  it("excludes articles older than the requested window", () => {
    const old = article({
      id: "store-test-old",
      discoveredAt: new Date(Date.now() - 100 * 3_600_000).toISOString(),
      publishedAt: new Date(Date.now() - 100 * 3_600_000).toISOString(),
    });
    upsertArticles([old]);
    const recent = getRecentArticles(1);
    expect(recent.some((r) => r.id === "store-test-old")).toBe(false);
  });

  it("cleanupOldArticles deletes articles past the retention window", () => {
    upsertArticles([
      article({
        id: "store-test-cleanup",
        discoveredAt: new Date(Date.now() - 200 * 3_600_000).toISOString(),
        publishedAt: new Date(Date.now() - 200 * 3_600_000).toISOString(),
      }),
    ]);
    cleanupOldArticles(72);
    const recent = getRecentArticles(1000);
    expect(recent.some((r) => r.id === "store-test-cleanup")).toBe(false);
  });

  it("is a no-op for an empty array (doesn't throw)", () => {
    expect(() => upsertArticles([])).not.toThrow();
  });
});
