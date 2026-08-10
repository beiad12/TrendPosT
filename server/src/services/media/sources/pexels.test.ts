import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("pexels — not configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.PEXELS_API_KEY;
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("reports not configured without an API key", async () => {
    const { pexelsConfigured } = await import("./pexels.js");
    expect(pexelsConfigured).toBe(false);
  });
});

describe("searchPexels — configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PEXELS_API_KEY = "test_key";
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.PEXELS_API_KEY;
  });

  it("sends the raw key as Authorization (no Bearer prefix) and returns the large2x URL", async () => {
    (global.fetch as any).mockImplementation(async (_url: string, init: any) => {
      expect(init.headers.Authorization).toBe("test_key");
      return {
        ok: true,
        json: async () => ({ photos: [{ src: { original: "https://images.pexels.com/o.jpg", large2x: "https://images.pexels.com/l2x.jpg", large: "https://images.pexels.com/l.jpg" } }] }),
      };
    });

    const { searchPexels } = await import("./pexels.js");
    const result = await searchPexels("storm sky");
    expect(result).toBe("https://images.pexels.com/l2x.jpg");
  });

  it("returns null when there are no results", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ photos: [] }) });
    const { searchPexels } = await import("./pexels.js");
    await expect(searchPexels("very obscure query")).resolves.toBeNull();
  });

  it("throws on a request failure", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 403 });
    const { searchPexels } = await import("./pexels.js");
    await expect(searchPexels("query")).rejects.toThrow(/403/);
  });
});
