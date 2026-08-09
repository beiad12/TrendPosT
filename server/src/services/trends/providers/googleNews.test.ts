import { describe, it, expect, vi, beforeEach } from "vitest";

const parseURL = vi.fn();

vi.mock("rss-parser", () => ({
  default: class {
    parseURL(url: string) {
      return parseURL(url);
    }
  },
}));

describe("googleNewsProvider", () => {
  beforeEach(() => {
    parseURL.mockReset();
    vi.resetModules();
  });

  it("normalizes items and strips the ' - Source' suffix Google News appends to titles", async () => {
    parseURL.mockResolvedValue({
      items: [
        {
          title: "Le Maroc annonce un nouveau projet - Hespress",
          link: "https://hespress.com/a?utm_source=google",
          pubDate: "Sun, 09 Aug 2026 12:00:00 GMT",
          contentSnippet: "Some snippet text",
        },
      ],
    });

    const { googleNewsProvider } = await import("./googleNews.js");
    const articles = await googleNewsProvider.fetch();
    expect(articles.length).toBeGreaterThan(0);
    const a = articles.find((x) => x.url === "https://hespress.com/a")!;
    expect(a).toBeDefined();
    expect(a.title).toBe("Le Maroc annonce un nouveau projet");
    expect(a.source).toBe("Hespress");
    expect(a.provider).toBe("google_news");
  });

  it("isolates a single failing query (e.g. one 404) — other queries still contribute results", async () => {
    let call = 0;
    parseURL.mockImplementation(async () => {
      call++;
      if (call <= 3) throw new Error("Status code 404");
      return { items: [{ title: "Story - Le360", link: `https://le360.ma/${call}`, pubDate: "Sun, 09 Aug 2026 12:00:00 GMT" }] };
    });

    const { googleNewsProvider } = await import("./googleNews.js");
    const articles = await googleNewsProvider.fetch();
    expect(articles.length).toBeGreaterThan(0);
  });

  it("throws only when every single query fails", async () => {
    parseURL.mockRejectedValue(new Error("Status code 404"));
    const { googleNewsProvider } = await import("./googleNews.js");
    await expect(googleNewsProvider.fetch()).rejects.toThrow();
  });
});
