import { describe, it, expect } from "vitest";
import { scoreCluster } from "./scoring.js";
import type { UnscoredCluster } from "./clustering.js";
import type { RawArticle } from "./types.js";

function article(overrides: Partial<RawArticle> = {}): RawArticle {
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

function cluster(overrides: Partial<UnscoredCluster> = {}, articles: RawArticle[] = [article()]): UnscoredCluster {
  const now = new Date().toISOString();
  return {
    id: "c1",
    title: "Le Maroc annonce une nouvelle mesure",
    articles,
    sourceCount: 1,
    sources: ["Test"],
    language: "fr",
    description: null,
    imageUrl: null,
    publishedAt: now,
    discoveredAt: now,
    ...overrides,
  };
}

describe("scoreCluster — freshness", () => {
  it("scores a just-published story near the max freshness weight", () => {
    const now = new Date();
    const c = cluster({ publishedAt: now.toISOString() });
    const scored = scoreCluster(c, now);
    expect(scored.scoreBreakdown.freshness).toBe(20);
  });

  it("scores a 2-hour-old story lower than a fresh one", () => {
    const now = new Date();
    const fresh = scoreCluster(cluster({ publishedAt: now.toISOString() }), now);
    const twoHoursOld = scoreCluster(cluster({ publishedAt: new Date(now.getTime() - 2 * 3_600_000).toISOString() }), now);
    expect(twoHoursOld.scoreBreakdown.freshness).toBeLessThan(fresh.scoreBreakdown.freshness);
  });

  it("scores a story older than 24h near zero freshness", () => {
    const now = new Date();
    const old = scoreCluster(cluster({ publishedAt: new Date(now.getTime() - 30 * 3_600_000).toISOString() }), now);
    expect(old.scoreBreakdown.freshness).toBeLessThanOrEqual(2);
  });
});

describe("scoreCluster — sourceCount", () => {
  it("rewards more independent sources", () => {
    const now = new Date();
    const one = scoreCluster(cluster({ sourceCount: 1 }), now);
    const five = scoreCluster(cluster({ sourceCount: 5 }), now);
    expect(five.scoreBreakdown.sourceCount).toBeGreaterThan(one.scoreBreakdown.sourceCount);
    expect(five.scoreBreakdown.sourceCount).toBe(20); // 5+ sources = full weight
  });
});

describe("scoreCluster — velocity", () => {
  it("gives an accelerating cluster (many recent articles) a high velocity score", () => {
    const now = new Date();
    const nowMs = now.getTime();
    const articles = [
      article({ discoveredAt: new Date(nowMs - 5 * 60_000).toISOString() }),
      article({ discoveredAt: new Date(nowMs - 10 * 60_000).toISOString() }),
      article({ discoveredAt: new Date(nowMs - 15 * 60_000).toISOString() }),
      article({ discoveredAt: new Date(nowMs - 20 * 60_000).toISOString() }),
    ];
    const scored = scoreCluster(cluster({ articles, sourceCount: 4 }, articles), now);
    expect(scored.velocityPerHour).toBeGreaterThanOrEqual(4);
    expect(scored.scoreBreakdown.velocity).toBeGreaterThan(0);
  });

  it("gives a cluster with no recent activity zero velocity", () => {
    const now = new Date();
    const nowMs = now.getTime();
    const articles = [article({ discoveredAt: new Date(nowMs - 10 * 3_600_000).toISOString() })];
    const scored = scoreCluster(cluster({ articles }, articles), now);
    expect(scored.velocityPerHour).toBe(0);
    expect(scored.scoreBreakdown.velocity).toBe(0);
  });
});

describe("scoreCluster — Morocco relevance", () => {
  it("gives full relevance to a directly Morocco-related story", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Le Maroc inaugure un nouveau port à Tanger" }), now);
    expect(scored.scoreBreakdown.moroccoRelevance).toBe(15);
  });

  it("gives partial relevance to an international story naming another country", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Tensions commerciales entre la France et l'Espagne" }), now);
    expect(scored.scoreBreakdown.moroccoRelevance).toBeLessThan(15);
    expect(scored.scoreBreakdown.moroccoRelevance).toBeGreaterThan(0);
  });

  it("gives low relevance to an unrelated worldwide story", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Une nouvelle exposition ouvre ses portes" }), now);
    expect(scored.scoreBreakdown.moroccoRelevance).toBeLessThanOrEqual(3);
  });
});

describe("scoreCluster — category classification", () => {
  it("classifies a breaking-news headline as 'breaking'", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "عاجل: زلزال يضرب المنطقة" }), now);
    expect(scored.categoryKey).toBe("breaking");
  });

  it("classifies a football headline as 'sports'", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Les Lions de l'Atlas se qualifient pour le championnat" }), now);
    expect(scored.categoryKey).toBe("sports");
  });

  it("falls back to the 'morocco' catch-all category when nothing more specific matches", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Une réunion s'est tenue mardi dans la capitale" }), now);
    expect(scored.categoryKey).toBe("morocco");
  });

  it("classifies a government/minister headline as 'politics'", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Le ministre reçoit une délégation étrangère" }), now);
    expect(scored.categoryKey).toBe("politics");
  });

  it("classifies an army/conflict headline as 'military'", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "L'armée annonce une nouvelle opération militaire" }), now);
    expect(scored.categoryKey).toBe("military");
  });

  it("classifies a celebrity-gossip headline as 'celebrity'", () => {
    const now = new Date();
    const scored = scoreCluster(cluster({ title: "Cette célébrité fait sensation avec sa nouvelle apparition" }), now);
    expect(scored.categoryKey).toBe("celebrity");
  });

  it("classifies a Reddit-sourced story with no specific category match as 'viral', not the weak generic catch-all", () => {
    const now = new Date();
    const articles = [article({ provider: "reddit:popular", title: "Something unusual is happening" })];
    const scored = scoreCluster(cluster({ title: "Something unusual is happening", articles }, articles), now);
    expect(scored.categoryKey).toBe("viral");
  });

  it("still classifies a Reddit-sourced sports story as 'sports', not 'viral'", () => {
    const now = new Date();
    const articles = [article({ provider: "reddit:popular", title: "Incredible football match ends in a dramatic finish" })];
    const scored = scoreCluster(cluster({ title: "Incredible football match ends in a dramatic finish", articles }, articles), now);
    expect(scored.categoryKey).toBe("sports");
  });
});

describe("scoreCluster — trend type classification", () => {
  it("classifies a very fresh, fast-accelerating story as BREAKING", () => {
    const now = new Date();
    const nowMs = now.getTime();
    const articles = [
      article({ discoveredAt: new Date(nowMs - 2 * 60_000).toISOString() }),
      article({ discoveredAt: new Date(nowMs - 5 * 60_000).toISOString() }),
      article({ discoveredAt: new Date(nowMs - 8 * 60_000).toISOString() }),
    ];
    const scored = scoreCluster(cluster({ publishedAt: now.toISOString(), articles, sourceCount: 3 }, articles), now);
    expect(scored.trendType).toBe("BREAKING");
  });

  it("classifies an older but still well-corroborated story as POPULAR or STABLE, not BREAKING", () => {
    const now = new Date();
    const articles = [article({ discoveredAt: new Date(now.getTime() - 20 * 3_600_000).toISOString() })];
    const scored = scoreCluster(
      cluster({ publishedAt: new Date(now.getTime() - 20 * 3_600_000).toISOString(), sourceCount: 4, articles }, articles),
      now
    );
    expect(scored.trendType).not.toBe("BREAKING");
  });
});

describe("scoreCluster — total", () => {
  it("never exceeds 100", () => {
    const now = new Date();
    const nowMs = now.getTime();
    const manyArticles = Array.from({ length: 10 }, (_, i) =>
      article({ discoveredAt: new Date(nowMs - i * 60_000).toISOString(), provider: i % 2 === 0 ? "reddit:Morocco" : "google_news" })
    );
    const scored = scoreCluster(
      cluster(
        {
          title: "عاجل صادم: المغرب يفوز ببطولة كبرى وسط احتفالات صاخبة",
          publishedAt: now.toISOString(),
          sourceCount: 10,
          articles: manyArticles,
        },
        manyArticles
      ),
      now
    );
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.scoreBreakdown.total).toBe(scored.score);
  });
});
