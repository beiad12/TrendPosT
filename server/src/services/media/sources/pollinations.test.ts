import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generatePollinationsImage, pollinationsConfigured } from "./pollinations.js";

describe("generatePollinationsImage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("is always considered configured -- no API key required", () => {
    expect(pollinationsConfigured).toBe(true);
  });

  it("returns a real Buffer for a successful response", async () => {
    const fakeImageBytes = Buffer.alloc(2000, 1); // well over the "suspiciously small" floor
    (global.fetch as any).mockImplementation(async (url: string) => {
      expect(url).toContain(encodeURIComponent("a storm over Casablanca"));
      return { ok: true, arrayBuffer: async () => fakeImageBytes.buffer };
    });

    const result = await generatePollinationsImage("a storm over Casablanca");
    expect(result.length).toBe(2000);
  });

  it("throws on a non-OK response", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(generatePollinationsImage("prompt")).rejects.toThrow(/500/);
  });

  it("throws when the response is suspiciously small (likely an error page, not a photo)", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode("tiny").buffer });
    await expect(generatePollinationsImage("prompt")).rejects.toThrow(/small/);
  });
});
