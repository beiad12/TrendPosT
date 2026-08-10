import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../ai/keyVault.js", () => ({
  getProviderApiKey: vi.fn(),
}));

describe("generateOpenAiImage — no key configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws without ever calling the API", async () => {
    const { getProviderApiKey } = await import("../../ai/keyVault.js");
    (getProviderApiKey as any).mockReturnValue(null);

    const { generateOpenAiImage, openaiImageConfigured } = await import("./openaiImage.js");
    expect(openaiImageConfigured()).toBe(false);
    await expect(generateOpenAiImage("a photo of a storm")).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("generateOpenAiImage — configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns a real Buffer decoded from the API's base64 response", async () => {
    const { getProviderApiKey } = await import("../../ai/keyVault.js");
    (getProviderApiKey as any).mockReturnValue("sk-test");

    const fakeImageBytes = Buffer.from("fake-png-bytes");
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageBytes.toString("base64") }] }),
    });

    const { generateOpenAiImage, openaiImageConfigured } = await import("./openaiImage.js");
    expect(openaiImageConfigured()).toBe(true);
    const result = await generateOpenAiImage("a photorealistic photo of a storm");
    expect(result.equals(fakeImageBytes)).toBe(true);
  });

  it("throws on an API error", async () => {
    const { getProviderApiKey } = await import("../../ai/keyVault.js");
    (getProviderApiKey as any).mockReturnValue("sk-test");
    (global.fetch as any).mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });

    const { generateOpenAiImage } = await import("./openaiImage.js");
    await expect(generateOpenAiImage("prompt")).rejects.toThrow();
  });
});
