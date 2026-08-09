import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("redditProvider — not configured", () => {
  const originalId = process.env.REDDIT_CLIENT_ID;
  const originalSecret = process.env.REDDIT_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalId) process.env.REDDIT_CLIENT_ID = originalId;
    if (originalSecret) process.env.REDDIT_CLIENT_SECRET = originalSecret;
  });

  it("reports enabled=false and a disabledReason when no credentials are set — never an error", async () => {
    const { redditProvider } = await import("./reddit.js");
    expect(redditProvider.enabled).toBe(false);
    expect(redditProvider.disabledReason).toContain("REDDIT_CLIENT_ID");
  });
});

describe("redditProvider — configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = "test_id";
    process.env.REDDIT_CLIENT_SECRET = "test_secret";
    process.env.REDDIT_USER_AGENT = "TestBot/1.0";
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    delete process.env.REDDIT_USER_AGENT;
  });

  it("enabled=true once credentials are present, and fetches via the OAuth token flow", async () => {
    (global.fetch as any).mockImplementation(async (url: string, init: any) => {
      if (String(url).includes("access_token")) {
        expect(init.headers.Authorization).toMatch(/^Basic /);
        return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
      }
      expect(init.headers.Authorization).toBe("Bearer tok");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: "Something big happened",
                  permalink: "/r/Morocco/comments/1/something/",
                  url: "https://example.com/x",
                  created_utc: Math.floor(Date.now() / 1000),
                  is_self: false,
                },
              },
            ],
          },
        }),
      };
    });

    const { redditProvider } = await import("./reddit.js");
    expect(redditProvider.enabled).toBe(true);
    const articles = await redditProvider.fetch();
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].title).toBe("Something big happened");
  });

  it("isolates a 403 on one subreddit — the other can still succeed", async () => {
    let subredditCalls = 0;
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes("access_token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
      }
      subredditCalls++;
      if (subredditCalls === 1) return { ok: false, status: 403, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ data: { children: [] } }) };
    });

    const { redditProvider } = await import("./reddit.js");
    // Should not throw -- one subreddit failing is isolated (Promise.allSettled internally).
    await expect(redditProvider.fetch()).resolves.toBeDefined();
  });
});
