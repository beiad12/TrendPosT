import { describe, it, expect } from "vitest";
import { buildWebSearchQueries, buildAiImagePrompt } from "./imagePrompt.js";

describe("buildWebSearchQueries", () => {
  it("uses a dedicated weather query, not the literal headline, for the weather category", () => {
    const queries = buildWebSearchQueries({ title: "Storm hits Casablanca coast", categoryKey: "weather" });
    expect(queries[0]).toContain("weather");
    expect(queries.some((q) => /storm sky clouds/i.test(q))).toBe(true);
  });

  it("tries the headline first, then a category-level fallback, for non-weather categories", () => {
    const queries = buildWebSearchQueries({ title: "Le Wydad remporte le titre", categoryKey: "sports" });
    expect(queries[0]).toBe("Le Wydad remporte le titre");
    expect(queries[1]).toBe("Sports");
  });

  it("falls back to just the headline when the category is unknown", () => {
    const queries = buildWebSearchQueries({ title: "Some story" });
    expect(queries).toEqual(["Some story"]);
  });
});

describe("buildAiImagePrompt", () => {
  it("builds a weather-specific prompt", () => {
    const prompt = buildAiImagePrompt({ title: "Storm hits Casablanca coast", categoryKey: "weather" });
    expect(prompt).toContain("weather event");
    expect(prompt).toContain("Storm hits Casablanca coast");
  });

  it("includes the description when present, for richer context", () => {
    const prompt = buildAiImagePrompt({
      title: "New stadium opens",
      description: "A 60,000-seat stadium in Rabat opened its doors this week.",
      categoryKey: "sports",
    });
    expect(prompt).toContain("New stadium opens");
    expect(prompt).toContain("60,000-seat stadium");
  });

  it("steers away from fabricated text/watermarks/logos in every prompt", () => {
    const prompt = buildAiImagePrompt({ title: "Some story" });
    expect(prompt).toMatch(/no text/i);
    expect(prompt).toMatch(/no watermarks/i);
  });
});
