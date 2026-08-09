import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gdeltProvider } from "./gdelt.js";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function errorResponse(status: number) {
  return { ok: false, status, text: async () => "" } as Response;
}

describe("gdeltProvider", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("normalizes a successful response into RawArticle[]", async () => {
    (global.fetch as any).mockResolvedValue(
      jsonResponse({
        articles: [
          {
            url: "https://example.com/a?utm_source=x",
            title: "Morocco announces new initiative",
            seendate: "20260809T120000Z",
            domain: "example.com",
            language: "English",
            sourcecountry: "Morocco",
            socialimage: "https://example.com/img.jpg",
          },
        ],
      })
    );

    const articles = await gdeltProvider.fetch();
    expect(articles.length).toBeGreaterThan(0);
    const a = articles[0];
    expect(a.title).toBe("Morocco announces new initiative");
    expect(a.url).toBe("https://example.com/a"); // tracking param stripped
    expect(a.sourceDomain).toBe("example.com");
    expect(a.publishedAt).toBe("2026-08-09T12:00:00.000Z");
    expect(a.imageUrl).toBe("https://example.com/img.jpg");
    expect(a.provider).toBe("gdelt");
  });

  it("isolates a single failing query — other queries still contribute results (403)", async () => {
    let call = 0;
    (global.fetch as any).mockImplementation(async () => {
      call++;
      if (call === 1) return errorResponse(403);
      return jsonResponse({ articles: [{ url: "https://x.com/1", title: "Story", seendate: "20260809T120000Z", domain: "x.com" }] });
    });

    const articles = await gdeltProvider.fetch();
    expect(articles.length).toBeGreaterThan(0);
  });

  it("throws only when every query fails (so the aggregator marks the provider degraded, not silently empty)", async () => {
    (global.fetch as any).mockResolvedValue(errorResponse(404));
    await expect(gdeltProvider.fetch()).rejects.toThrow();
  });

  it("treats malformed JSON as a query failure, not a crash", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, text: async () => "<html>not json</html>" } as Response);
    await expect(gdeltProvider.fetch()).rejects.toThrow();
  });
});
