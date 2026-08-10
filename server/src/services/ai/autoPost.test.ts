import { describe, it, expect, vi, beforeEach } from "vitest";

const fakeTemplate = {
  id: "tmpl-1",
  name: "AI Auto Post — Photo + Headline",
  category: "news",
  baseImagePath: "/tmp/fake.png",
  canvasWidth: 1080,
  canvasHeight: 1080,
  zones: [],
  style: {},
  createdAt: "",
  updatedAt: "",
};

const baseTrend = {
  title: "Storm hits Casablanca coast",
  sourceUrl: "https://example.com/a",
  source: "Test Source",
  category: "weather",
};

function mockCommonDeps(overrides: { imageSearchResult?: string | null; aiImageResult?: Buffer | null; captionsThrow?: boolean } = {}) {
  vi.doMock("../templateStore.js", () => ({
    getTemplateById: () => fakeTemplate,
    getTemplateByName: () => fakeTemplate,
  }));
  vi.doMock("../brandingStore.js", () => ({
    getWatermarkOption: () => undefined,
  }));
  vi.doMock("../render/renderEngine.js", () => ({
    renderPost: vi.fn(async () => Buffer.from("rendered-image")),
  }));
  vi.doMock("./router.js", () => ({
    generateCaptions: overrides.captionsThrow
      ? vi.fn(async () => {
          throw new Error("caption provider down");
        })
      : vi.fn(async () => ({
          provider: "anthropic",
          model: "claude-sonnet-5",
          variants: [{ tone: "informative", language: "french", caption: "Une grosse tempête frappe Casablanca.", hashtags: ["#Maroc"] }],
          headline: "Tempête à Casablanca",
        })),
  }));
  vi.doMock("../media/webImageSearch.js", () => ({
    searchWebImage: vi.fn(async () => overrides.imageSearchResult ?? null),
  }));
  vi.doMock("../media/aiImageGen.js", () => ({
    generateAiImage: vi.fn(async () => overrides.aiImageResult ?? null),
  }));
}

describe("generateAutoPost — photo fallback chain", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  it("uses the trend's own photo when it's reachable, never touching search/AI generation", async () => {
    mockCommonDeps();
    (global.fetch as any).mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode("real-photo-bytes").buffer });

    const { generateAutoPost } = await import("./autoPost.js");
    const { searchWebImage } = await import("../media/webImageSearch.js");
    const { generateAiImage } = await import("../media/aiImageGen.js");

    const result = await generateAutoPost({
      trend: { ...baseTrend, imageUrl: "https://example.com/photo.jpg" },
      provider: "anthropic",
      language: "french",
    });

    expect(result.photoSource).toBe("provided");
    expect(searchWebImage).not.toHaveBeenCalled();
    expect(generateAiImage).not.toHaveBeenCalled();
  });

  it("falls through to web image search when the trend has no photo", async () => {
    mockCommonDeps({ imageSearchResult: "https://images.unsplash.com/found.jpg" });
    (global.fetch as any).mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode("web-photo-bytes").buffer });

    const { generateAutoPost } = await import("./autoPost.js");
    const { generateAiImage } = await import("../media/aiImageGen.js");

    const result = await generateAutoPost({
      trend: { ...baseTrend, imageUrl: null },
      provider: "anthropic",
      language: "french",
    });

    expect(result.photoSource).toBe("web-search");
    expect(generateAiImage).not.toHaveBeenCalled();
  });

  it("falls through to AI image generation when there's no photo and web search finds nothing", async () => {
    mockCommonDeps({ imageSearchResult: null, aiImageResult: Buffer.from("ai-generated-bytes") });

    const { generateAutoPost } = await import("./autoPost.js");

    const result = await generateAutoPost({
      trend: { ...baseTrend, imageUrl: null },
      provider: "anthropic",
      language: "french",
    });

    expect(result.photoSource).toBe("ai-generated");
  });

  it("falls through to web search when the trend's own photo URL is unreachable", async () => {
    mockCommonDeps({ imageSearchResult: "https://images.unsplash.com/found.jpg" });
    let call = 0;
    (global.fetch as any).mockImplementation(async () => {
      call++;
      if (call === 1) return { ok: false, status: 404 }; // the trend's own (broken) photo
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode("web-photo-bytes").buffer };
    });

    const { generateAutoPost } = await import("./autoPost.js");

    const result = await generateAutoPost({
      trend: { ...baseTrend, imageUrl: "https://example.com/broken.jpg" },
      provider: "anthropic",
      language: "french",
    });

    expect(result.photoSource).toBe("web-search");
  });

  it("throws AutoPostInputError with a clear message once every photo option is exhausted", async () => {
    mockCommonDeps({ imageSearchResult: null, aiImageResult: null });

    const { generateAutoPost, AutoPostInputError } = await import("./autoPost.js");

    await expect(
      generateAutoPost({ trend: { ...baseTrend, imageUrl: null }, provider: "anthropic", language: "french" })
    ).rejects.toBeInstanceOf(AutoPostInputError);
  });

  it("passes the category through so weather trends get a weather-specific search/prompt", async () => {
    mockCommonDeps({ imageSearchResult: "https://images.unsplash.com/storm.jpg" });
    (global.fetch as any).mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode("bytes").buffer });

    const { generateAutoPost } = await import("./autoPost.js");
    const { searchWebImage } = await import("../media/webImageSearch.js");

    await generateAutoPost({
      trend: { ...baseTrend, category: "weather", imageUrl: null },
      provider: "anthropic",
      language: "french",
    });

    const queriesUsed = (searchWebImage as any).mock.calls[0][0] as string[];
    expect(queriesUsed.some((q: string) => /weather/i.test(q))).toBe(true);
  });
});
