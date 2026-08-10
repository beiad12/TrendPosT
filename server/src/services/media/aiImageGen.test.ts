import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../ai/keyVault.js", () => ({
  getProviderApiKey: vi.fn(),
}));

describe("generateAiImage — no OpenAI key configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns null without ever calling the API", async () => {
    const { getProviderApiKey } = await import("../ai/keyVault.js");
    (getProviderApiKey as any).mockReturnValue(null);

    const { generateAiImage } = await import("./aiImageGen.js");
    const result = await generateAiImage("a photo of a storm");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("generateAiImage — configured", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns a real Buffer decoded from the API's base64 response", async () => {
    const { getProviderApiKey } = await import("../ai/keyVault.js");
    (getProviderApiKey as any).mockReturnValue("sk-test");

    const fakeImageBytes = Buffer.from("fake-png-bytes");
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: fakeImageBytes.toString("base64") }] }),
    });

    const { generateAiImage } = await import("./aiImageGen.js");
    const result = await generateAiImage("a photorealistic photo of a storm");
    expect(result).toBeInstanceOf(Buffer);
    expect(result!.equals(fakeImageBytes)).toBe(true);
  });

  it("throws (not a silent null) on an API error, so the caller can log/report it", async () => {
    const { getProviderApiKey } = await import("../ai/keyVault.js");
    (getProviderApiKey as any).mockReturnValue("sk-test");
    (global.fetch as any).mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });

    const { generateAiImage } = await import("./aiImageGen.js");
    await expect(generateAiImage("prompt")).rejects.toThrow();
  });
});
