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

describe("fetchGoogleNewsForCountry", () => {
  beforeEach(() => {
    parseURL.mockReset();
    vi.resetModules();
  });

  it("tags articles with a per-country provider id and the requested country/language", async () => {
    parseURL.mockResolvedValue({
      items: [{ title: "Big story in Japan - NHK", link: "https://nhk.jp/a", pubDate: "Sun, 09 Aug 2026 12:00:00 GMT" }],
    });

    const { fetchGoogleNewsForCountry } = await import("./googleNews.js");
    const { getCountry } = await import("../countries.js");
    const articles = await fetchGoogleNewsForCountry(getCountry("JP")!);

    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].provider).toBe("google_news:JP");
    expect(articles[0].country).toBe("JP");
    expect(articles[0].language).toBe("ja");
  });

  it("throws only when every query for that country fails, isolated from other countries", async () => {
    parseURL.mockRejectedValue(new Error("Status code 500"));
    const { fetchGoogleNewsForCountry } = await import("./googleNews.js");
    const { getCountry } = await import("../countries.js");
    await expect(fetchGoogleNewsForCountry(getCountry("BR")!)).rejects.toThrow();
  });
});
