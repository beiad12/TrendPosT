import { describe, it, expect } from "vitest";
import {
  cleanUrl,
  domainFromUrl,
  jaccardSimilarity,
  normalizeTitleForComparison,
  stableIdFromUrl,
  titleTokens,
} from "./normalize.js";

describe("normalizeTitleForComparison", () => {
  it("normalizes Arabic letter variants and strips diacritics without touching the original", () => {
    const a = normalizeTitleForComparison("المَغرِبُ يُعلِنُ عَن مَشروعٍ جَديدٍ");
    const b = normalizeTitleForComparison("المغرب يعلن عن مشروع جديد");
    expect(a).toBe(b);
  });

  it("normalizes French accents and case", () => {
    const a = normalizeTitleForComparison("Le Maroc Annonce Une Nouvelle Mesure Économique");
    const b = normalizeTitleForComparison("le maroc annonce une nouvelle mesure economique");
    expect(a).toBe(b);
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(normalizeTitleForComparison("Maroc:  une nouvelle mesure!!")).toBe("maroc une nouvelle mesure");
  });
});

describe("titleTokens + jaccardSimilarity", () => {
  it("scores reworded headlines about the same story as highly similar", () => {
    const a = titleTokens("Le Maroc annonce une nouvelle mesure économique majeure");
    const b = titleTokens("Maroc : une nouvelle mesure économique majeure annoncée");
    expect(jaccardSimilarity(a, b)).toBeGreaterThan(0.5);
  });

  it("scores unrelated headlines as dissimilar", () => {
    const a = titleTokens("Le Wydad remporte le championnat national");
    const b = titleTokens("Nouvelle réforme fiscale annoncée par le gouvernement");
    expect(jaccardSimilarity(a, b)).toBeLessThan(0.2);
  });

  it("drops common stopwords from both languages", () => {
    const tokens = titleTokens("في المغرب و de la nouvelle مشروع");
    expect(tokens.has("في")).toBe(false);
    expect(tokens.has("de")).toBe(false);
    expect(tokens.has("la")).toBe(false);
  });
});

describe("cleanUrl", () => {
  it("strips tracking params and the fragment", () => {
    expect(cleanUrl("https://example.com/article?utm_source=fb&utm_medium=social&id=42#section")).toBe(
      "https://example.com/article?id=42"
    );
  });

  it("passes through a URL with no tracking params unchanged", () => {
    expect(cleanUrl("https://example.com/article?id=42")).toBe("https://example.com/article?id=42");
  });

  it("falls back to the raw string for an unparseable URL", () => {
    expect(cleanUrl("not a url")).toBe("not a url");
  });
});

describe("domainFromUrl", () => {
  it("drops the www prefix", () => {
    expect(domainFromUrl("https://www.hespress.com/article/123")).toBe("hespress.com");
  });

  it("returns an empty string for an unparseable URL", () => {
    expect(domainFromUrl("not a url")).toBe("");
  });
});

describe("stableIdFromUrl", () => {
  it("is deterministic for the same URL", () => {
    const url = "https://example.com/article?id=1";
    expect(stableIdFromUrl(url)).toBe(stableIdFromUrl(url));
  });

  it("ignores tracking-param differences (same article, different campaign link)", () => {
    const a = stableIdFromUrl("https://example.com/article?id=1&utm_source=facebook");
    const b = stableIdFromUrl("https://example.com/article?id=1&utm_source=twitter");
    expect(a).toBe(b);
  });

  it("differs for genuinely different articles", () => {
    const a = stableIdFromUrl("https://example.com/article?id=1");
    const b = stableIdFromUrl("https://example.com/article?id=2");
    expect(a).not.toBe(b);
  });
});
