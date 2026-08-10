import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("searchWebImage — not configured", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.UNSPLASH_ACCESS_KEY;

  beforeEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey) process.env.UNSPLASH_ACCESS_KEY = originalKey;
  });

  it("returns null without ever calling fetch when no access key is set", async () => {
    const { searchWebImage } = await import("./webImageSearch.js");
    const result = await searchWebImage(["Morocco storm"]);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("searchWebImage — configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.UNSPLASH_ACCESS_KEY = "test_key";
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.UNSPLASH_ACCESS_KEY;
  });

  it("returns a sized raw URL from the first successful query", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      expect(url).toContain("query=Morocco");
      return {
        ok: true,
        json: async () => ({ results: [{ urls: { raw: "https://images.unsplash.com/photo-1", regular: "https://images.unsplash.com/photo-1?small" } }] }),
      };
    });

    const { searchWebImage } = await import("./webImageSearch.js");
    const result = await searchWebImage(["Morocco storm"]);
    expect(result).toBe("https://images.unsplash.com/photo-1&w=2400&q=80&fm=jpg");
  });

  it("falls through to the next query when the first returns no results", async () => {
    let call = 0;
    (global.fetch as any).mockImplementation(async () => {
      call++;
      if (call === 1) return { ok: true, json: async () => ({ results: [] }) };
      return { ok: true, json: async () => ({ results: [{ urls: { raw: "https://images.unsplash.com/photo-2", regular: "x" } }] }) };
    });

    const { searchWebImage } = await import("./webImageSearch.js");
    const result = await searchWebImage(["too specific a headline", "weather storm sky clouds"]);
    expect(result).toContain("photo-2");
    expect(call).toBe(2);
  });

  it("returns null (not a thrown error) when every query fails", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    const { searchWebImage } = await import("./webImageSearch.js");
    await expect(searchWebImage(["a", "b"])).resolves.toBeNull();
  });
});

describe("searchWebImage — both Unsplash and Pexels configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.UNSPLASH_ACCESS_KEY = "unsplash_test_key";
    process.env.PEXELS_API_KEY = "pexels_test_key";
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PEXELS_API_KEY;
  });

  it("falls through to Pexels for the same query when Unsplash has nothing", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes("unsplash")) return { ok: true, json: async () => ({ results: [] }) };
      return { ok: true, json: async () => ({ photos: [{ src: { large2x: "https://images.pexels.com/found.jpg" } }] }) };
    });

    const { searchWebImage } = await import("./webImageSearch.js");
    const result = await searchWebImage(["a rare headline"]);
    expect(result).toBe("https://images.pexels.com/found.jpg");
  });

  it("never calls Pexels when Unsplash already found something for that query", async () => {
    const pexelsCall = vi.fn();
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes("unsplash")) return { ok: true, json: async () => ({ results: [{ urls: { raw: "https://images.unsplash.com/x", regular: "x" } }] }) };
      pexelsCall();
      return { ok: true, json: async () => ({ photos: [] }) };
    });

    const { searchWebImage } = await import("./webImageSearch.js");
    await searchWebImage(["a headline"]);
    expect(pexelsCall).not.toHaveBeenCalled();
  });
});
