import { describe, it, expect, vi, beforeEach } from "vitest";

describe("generateAiImage — orchestrator", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("prefers Pollinations (free, no key needed) and never touches OpenAI when it succeeds", async () => {
    const pollinationsBuffer = Buffer.from("pollinations-bytes");
    const pollinationsFn = vi.fn(async () => pollinationsBuffer);
    const openaiFn = vi.fn(async () => Buffer.from("should-not-be-called"));

    vi.doMock("./sources/pollinations.js", () => ({ generatePollinationsImage: pollinationsFn, pollinationsConfigured: true }));
    vi.doMock("./sources/openaiImage.js", () => ({ generateOpenAiImage: openaiFn, openaiImageConfigured: () => true }));

    const { generateAiImage } = await import("./aiImageGen.js");
    const result = await generateAiImage("a photo of a storm");

    expect(result.equals(pollinationsBuffer)).toBe(true);
    expect(pollinationsFn).toHaveBeenCalledTimes(1);
    expect(openaiFn).not.toHaveBeenCalled();
  });

  it("falls through to OpenAI when Pollinations fails and OpenAI is configured", async () => {
    const openaiBuffer = Buffer.from("openai-bytes");
    vi.doMock("./sources/pollinations.js", () => ({
      generatePollinationsImage: vi.fn(async () => {
        throw new Error("Pollinations timed out");
      }),
      pollinationsConfigured: true,
    }));
    vi.doMock("./sources/openaiImage.js", () => ({
      generateOpenAiImage: vi.fn(async () => openaiBuffer),
      openaiImageConfigured: () => true,
    }));

    const { generateAiImage } = await import("./aiImageGen.js");
    const result = await generateAiImage("a photo of a storm");
    expect(result.equals(openaiBuffer)).toBe(true);
  });

  it("never calls OpenAI when it isn't configured, and throws a combined error if Pollinations also failed", async () => {
    const openaiFn = vi.fn();
    vi.doMock("./sources/pollinations.js", () => ({
      generatePollinationsImage: vi.fn(async () => {
        throw new Error("Pollinations rate-limited");
      }),
      pollinationsConfigured: true,
    }));
    vi.doMock("./sources/openaiImage.js", () => ({
      generateOpenAiImage: openaiFn,
      openaiImageConfigured: () => false,
    }));

    const { generateAiImage } = await import("./aiImageGen.js");
    await expect(generateAiImage("prompt")).rejects.toThrow(/Pollinations rate-limited/);
    expect(openaiFn).not.toHaveBeenCalled();
  });

  it("throws a combined error naming both failures when everything fails", async () => {
    vi.doMock("./sources/pollinations.js", () => ({
      generatePollinationsImage: vi.fn(async () => {
        throw new Error("Pollinations down");
      }),
      pollinationsConfigured: true,
    }));
    vi.doMock("./sources/openaiImage.js", () => ({
      generateOpenAiImage: vi.fn(async () => {
        throw new Error("OpenAI quota exceeded");
      }),
      openaiImageConfigured: () => true,
    }));

    const { generateAiImage } = await import("./aiImageGen.js");
    await expect(generateAiImage("prompt")).rejects.toThrow(/Pollinations down.*OpenAI quota exceeded/s);
  });
});
