import { describe, it, expect } from "vitest";
import { COUNTRIES, getCountry, findCountryByMapName } from "./countries.js";
import { buildCountryQueryGroup } from "./config.js";

describe("countries", () => {
  it("has no duplicate ISO codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has no duplicate map names (each must uniquely match one topojson feature)", () => {
    const names = COUNTRIES.map((c) => c.mapName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("looks up a country by code case-insensitively", () => {
    expect(getCountry("fr")?.name).toBe("France");
    expect(getCountry("FR")?.name).toBe("France");
  });

  it("returns undefined for an unknown code", () => {
    expect(getCountry("ZZ")).toBeUndefined();
  });

  it("looks up a country by its map (topojson) name", () => {
    expect(findCountryByMapName("United States of America")?.code).toBe("US");
    expect(findCountryByMapName("Côte d'Ivoire")?.code).toBe("CI");
  });

  it("includes Morocco itself, since it's the app's home country", () => {
    expect(getCountry("MA")?.name).toBe("Morocco");
  });
});

describe("buildCountryQueryGroup", () => {
  it("builds a generic query set from the country's own name and language", () => {
    const france = getCountry("FR")!;
    const group = buildCountryQueryGroup(france);
    expect(group.language).toBe("fr");
    expect(group.country).toBe("FR");
    expect(group.queries).toContain("France");
    expect(group.queries.some((q) => q.includes("France"))).toBe(true);
    expect(group.queries.length).toBeGreaterThan(1);
  });

  it("produces a distinct query group per country", () => {
    const a = buildCountryQueryGroup(getCountry("JP")!);
    const b = buildCountryQueryGroup(getCountry("BR")!);
    expect(a.key).not.toBe(b.key);
    expect(a.queries).not.toEqual(b.queries);
  });
});
