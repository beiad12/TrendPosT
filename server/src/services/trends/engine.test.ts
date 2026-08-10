import { describe, it, expect, vi, beforeEach } from "vitest";
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

function makeProvider(id: string, opts: { enabled?: boolean; disabledReason?: string; fetch?: () => Promise<RawArticle[]> }) {
  return {
    id,
    name: id,
    type: "api" as const,
    enabled: opts.enabled ?? true,
    disabledReason: opts.disabledReason,
    fetch: opts.fetch ?? (async () => []),
  };
}

describe("TrendEngine", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("never crashes when every provider fails, and reports a warning instead of throwing", async () => {
    vi.doMock("./providers/index.js", () => ({
      ALL_PROVIDERS: [
        makeProvider("p1", { fetch: async () => { throw new Error("Status code 404"); } }),
        makeProvider("p2", { fetch: async () => { throw new Error("Status code 403"); } }),
      ],
    }));

    const { getTrends } = await import("./engine.js");
    const result = await getTrends(true);
    expect(result.trends).toEqual([]);
    expect(result.warning).toBe("no_live_data");
    expect(result.sourceHealth.every((h) => h.status === "degraded" || h.status === "unavailable")).toBe(true);
  });

  it("combines articles from multiple healthy providers into ranked trends", async () => {
    vi.doMock("./providers/index.js", () => ({
      ALL_PROVIDERS: [
        makeProvider("p1", { fetch: async () => [article({ id: "a1", title: "Le Maroc lance un grand projet national" })] }),
        makeProvider("p2", { fetch: async () => [article({ id: "a2", title: "Nouvelle victoire pour le sport marocain" })] }),
      ],
    }));

    const { getTrends } = await import("./engine.js");
    const result = await getTrends(true);
    expect(result.trends.length).toBeGreaterThanOrEqual(2);
    expect(result.warning).toBeUndefined();
    // Ranked descending by score.
    for (let i = 1; i < result.trends.length; i++) {
      expect(result.trends[i - 1].score).toBeGreaterThanOrEqual(result.trends[i].score);
    }
  });

  it("reports a disabled provider as not_configured without ever calling fetch()", async () => {
    const fetchSpy = vi.fn(async () => []);
    vi.doMock("./providers/index.js", () => ({
      ALL_PROVIDERS: [makeProvider("disabled_one", { enabled: false, disabledReason: "needs a key", fetch: fetchSpy })],
    }));

    const { getTrends } = await import("./engine.js");
    const result = await getTrends(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    const health = result.sourceHealth.find((h) => h.id === "disabled_one");
    expect(health?.status).toBe("not_configured");
  });

  it("one provider failing doesn't stop another's articles from appearing", async () => {
    vi.doMock("./providers/index.js", () => ({
      ALL_PROVIDERS: [
        makeProvider("failing", { fetch: async () => { throw new Error("Status code 500"); } }),
        makeProvider("working", { fetch: async () => [article({ id: "ok1", title: "Une histoire marocaine importante se déroule" })] }),
      ],
    }));

    const { getTrends } = await import("./engine.js");
    const result = await getTrends(true);
    expect(result.trends.length).toBeGreaterThan(0);
    expect(result.sourceHealth.find((h) => h.id === "working")?.status).toBe("healthy");
    expect(result.sourceHealth.find((h) => h.id === "failing")?.status).toBe("degraded");
  });

  it("serves from cache within the TTL instead of re-fetching every provider", async () => {
    const fetchSpy = vi.fn(async () => [article({ id: "cache1", title: "Une actualité qui reste en cache" })]);
    vi.doMock("./providers/index.js", () => ({
      ALL_PROVIDERS: [makeProvider("cached_provider", { fetch: fetchSpy })],
    }));

    const { getTrends } = await import("./engine.js");
    await getTrends(false);
    await getTrends(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("force refresh bypasses the cache and calls providers again", async () => {
    const fetchSpy = vi.fn(async () => [article({ id: "refresh1", title: "Une actualité rafraîchie manuellement" })]);
    vi.doMock("./providers/index.js", () => ({
      ALL_PROVIDERS: [makeProvider("refreshable_provider", { fetch: fetchSpy })],
    }));

    const { getTrends } = await import("./engine.js");
    await getTrends(false);
    await getTrends(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("TrendEngine — per-country (map picker)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function franceArticle(overrides: Partial<RawArticle> = {}): RawArticle {
    return article({ id: "fr1", title: "Big news happening in France today", country: "FR", language: "fr", provider: "google_news:FR", ...overrides });
  }

  it("fetches from the country-specific providers, tagged and scoped to that country", async () => {
    const googleNewsSpy = vi.fn(async () => [franceArticle()]);
    const gdeltSpy = vi.fn(async () => []);
    vi.doMock("./providers/googleNews.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGoogleNewsForCountry: googleNewsSpy,
    }));
    vi.doMock("./providers/gdelt.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGdeltForCountry: gdeltSpy,
    }));

    const { getTrendsForCountry } = await import("./engine.js");
    const { getCountry } = await import("./countries.js");
    const result = await getTrendsForCountry(getCountry("FR")!, true);

    expect(googleNewsSpy).toHaveBeenCalledTimes(1);
    expect(gdeltSpy).toHaveBeenCalledTimes(1);
    expect(result.trends.length).toBeGreaterThan(0);
    expect(result.trends[0].title).toContain("France");
  });

  it("scores relevance against the selected country's own name, not Morocco's keywords", async () => {
    vi.doMock("./providers/googleNews.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGoogleNewsForCountry: async () => [franceArticle({ title: "France announces a major new policy today" })],
    }));
    vi.doMock("./providers/gdelt.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGdeltForCountry: async () => [],
    }));

    const { getTrendsForCountry } = await import("./engine.js");
    const { getCountry } = await import("./countries.js");
    const result = await getTrendsForCountry(getCountry("FR")!, true);

    // A France-relevant headline fetched for France should score full relevance,
    // even though it never mentions Morocco.
    expect(result.trends[0].scoreBreakdown.moroccoRelevance).toBe(15);
  });

  it("keeps a separate cache per country -- refreshing France doesn't refetch Japan", async () => {
    const franceSpy = vi.fn(async () => [franceArticle()]);
    vi.doMock("./providers/googleNews.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGoogleNewsForCountry: franceSpy,
    }));
    vi.doMock("./providers/gdelt.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGdeltForCountry: async () => [],
    }));

    const { getTrendsForCountry } = await import("./engine.js");
    const { getCountry } = await import("./countries.js");
    await getTrendsForCountry(getCountry("FR")!, true);
    await getTrendsForCountry(getCountry("FR")!, false); // within TTL -> cached, no new call
    expect(franceSpy).toHaveBeenCalledTimes(1);
  });

  it("never crashes when both country providers fail", async () => {
    vi.doMock("./providers/googleNews.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGoogleNewsForCountry: async () => { throw new Error("Status code 500"); },
    }));
    vi.doMock("./providers/gdelt.js", async (importOriginal) => ({
      ...(await importOriginal<any>()),
      fetchGdeltForCountry: async () => { throw new Error("Status code 500"); },
    }));

    const { getTrendsForCountry } = await import("./engine.js");
    const { getCountry } = await import("./countries.js");
    const result = await getTrendsForCountry(getCountry("DE")!, true);
    expect(result.trends).toEqual([]);
    expect(result.warning).toBe("no_live_data");
  });
});
