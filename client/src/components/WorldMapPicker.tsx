import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import worldTopology from "world-atlas/countries-110m.json";
import { api, CountryOption } from "../lib/api.js";

/** Regional-indicator-symbol flag emoji from an ISO alpha-2 code — no image assets needed. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

interface GeographyFeature {
  rsmKey: string;
  properties: { name: string };
}

/**
 * A world map picker for choosing which country's news the trend engine
 * fetches — click a country (or use the dropdown fallback below the map)
 * and the dashboard re-fetches scoped to it. Backed by a real Natural
 * Earth topojson (world-atlas, bundled — no CDN dependency at runtime) so
 * the shapes are genuine country borders, not an approximation.
 */
export default function WorldMapPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    api.trends.countries().then((r) => setCountries(r.countries));
  }, []);

  const byMapName = useMemo(() => {
    const m = new Map<string, CountryOption>();
    for (const c of countries) m.set(c.mapName.toLowerCase(), c);
    return m;
  }, [countries]);

  const selected = countries.find((c) => c.code === value);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-neutral-400">
          Showing trends for{" "}
          <span className="text-white font-medium">
            {selected ? `${flagEmoji(selected.code)} ${selected.name}` : "Morocco"}
          </span>
        </p>
        <select
          className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-xs max-w-[180px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {flagEmoji(c.code)} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-md overflow-hidden bg-neutral-950 border border-neutral-800">
        <ComposableMap projectionConfig={{ scale: 148 }} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={worldTopology}>
            {({ geographies }: { geographies: GeographyFeature[] }) =>
              geographies.map((geo) => {
                const match = byMapName.get(geo.properties.name.toLowerCase());
                const isSelected = match?.code === value;
                const isHovered = match && hovered === match.code;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => match && onChange(match.code)}
                    onMouseEnter={() => match && setHovered(match.code)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      default: {
                        fill: isSelected ? "#C1272D" : match ? "#3f3f46" : "#27272a",
                        stroke: "#18181b",
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: match ? "pointer" : "default",
                      },
                      hover: {
                        fill: isSelected ? "#C1272D" : match ? "#52525b" : "#27272a",
                        stroke: "#18181b",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      pressed: {
                        fill: "#C1272D",
                        stroke: "#18181b",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
      {hovered && hovered !== value && (
        <p className="text-xs text-neutral-500 mt-1">
          {flagEmoji(hovered)} {countries.find((c) => c.code === hovered)?.name} — click to switch
        </p>
      )}
    </div>
  );
}
