import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function post(overrides: Record<string, unknown>) {
  return {
    title: "A wild story",
    permalink: "/r/tifu/comments/1/a_wild_story/",
    url: "https://example.com/x",
    created_utc: Math.floor(Date.now() / 1000),
    is_self: true,
    ups: 100,
    num_comments: 10,
    over_18: false,
    ...overrides,
  };
}

describe("getDramaticStories — no Reddit API keys (public-endpoint fallback)", () => {
  const originalFetch = global.fetch;
  const originalId = process.env.REDDIT_CLIENT_ID;
  const originalSecret = process.env.REDDIT_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalId) process.env.REDDIT_CLIENT_ID = originalId;
    if (originalSecret) process.env.REDDIT_CLIENT_SECRET = originalSecret;
  });

  it("works with zero setup — hits Reddit's public unauthenticated .json endpoint, no OAuth token request", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      expect(String(url)).not.toContain("access_token");
      expect(String(url)).not.toContain("oauth.reddit.com");
      if (String(url).includes("/r/tifu/")) {
        return { ok: true, status: 200, json: async () => ({ data: { children: [{ data: post({}) }] } }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: { children: [] } }) };
    });

    const { getDramaticStories } = await import("./dramaticStories.js");
    const result = await getDramaticStories();
    expect(result.configured).toBe(true);
    expect(result.usingFallback).toBe(true);
    expect(result.stories.length).toBeGreaterThan(0);
  });

  it("reports configured=false only when the public fallback also comes back empty everywhere", async () => {
    (global.fetch as any).mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));

    const { getDramaticStories } = await import("./dramaticStories.js");
    const result = await getDramaticStories();
    expect(result.configured).toBe(false);
    expect(result.usingFallback).toBe(true);
    expect(result.stories).toEqual([]);
    expect(result.reason).toContain("REDDIT_CLIENT_ID");
  });
});

describe("getDramaticStories — configured with a real Reddit API app", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = "test_id";
    process.env.REDDIT_CLIENT_SECRET = "test_secret";
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
  });

  it("fetches every curated subreddit via OAuth, normalizes posts, and ranks by engagement score", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes("access_token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
      }
      if (String(url).includes("/r/tifu/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: { children: [{ data: post({ title: "Low engagement", permalink: "/r/tifu/comments/1/low/", ups: 5, num_comments: 1 }) }] },
          }),
        };
      }
      if (String(url).includes("/r/AmItheAsshole/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              children: [
                { data: post({ title: "High engagement", permalink: "/r/AmItheAsshole/comments/2/high/", ups: 50000, num_comments: 4000 }) },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ data: { children: [] } }) };
    });

    const { getDramaticStories } = await import("./dramaticStories.js");
    const result = await getDramaticStories();
    expect(result.configured).toBe(true);
    expect(result.usingFallback).toBe(false);
    expect(result.stories.length).toBeGreaterThanOrEqual(2);
    // Higher engagement should rank first.
    expect(result.stories[0].title).toBe("High engagement");
    expect(result.stories[0].score).toBeGreaterThan(result.stories.find((s) => s.title === "Low engagement")!.score);
    // No Morocco-relevance component — this feed is deliberately worldwide.
    expect(result.stories[0].scoreBreakdown.moroccoRelevance).toBe(0);
    expect(result.stories[0].category).toBe("dramatic-story");
    expect(result.stories[0].language).toBe("en");
  });

  it("filters out NSFW posts (over_18) and isolates one failing subreddit from the rest", async () => {
    let calls = 0;
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes("access_token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
      }
      calls++;
      if (calls === 1) return { ok: false, status: 500, json: async () => ({}) };
      if (String(url).includes("/r/nottheonion/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              children: [
                { data: post({ title: "NSFW should be dropped", permalink: "/r/nottheonion/comments/3/nsfw/", over_18: true }) },
                { data: post({ title: "Clean story", permalink: "/r/nottheonion/comments/4/clean/" }) },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ data: { children: [] } }) };
    });

    const { getDramaticStories } = await import("./dramaticStories.js");
    const result = await getDramaticStories();
    expect(result.stories.some((s) => s.title === "NSFW should be dropped")).toBe(false);
  });

  it("caches results within the TTL — a second call doesn't refetch", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes("access_token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: { children: [{ data: post({}) }] } }) };
    });

    const { getDramaticStories } = await import("./dramaticStories.js");
    await getDramaticStories();
    const callsAfterFirst = (global.fetch as any).mock.calls.length;
    await getDramaticStories();
    expect((global.fetch as any).mock.calls.length).toBe(callsAfterFirst);
  });
});
