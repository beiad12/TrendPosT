import { useEffect, useState } from "react";
import { api, CategoryOption, Trend, TrendType, ProviderHealth } from "../lib/api.js";
import ScoreBadge from "../components/ScoreBadge.js";
import SourceHealthPanel from "../components/SourceHealthPanel.js";
import TrendDetailModal from "../components/TrendDetailModal.js";
import WorldMapPicker, { flagEmoji } from "../components/WorldMapPicker.js";

const TREND_TYPE_STYLE: Record<TrendType, { label: string; className: string }> = {
  BREAKING: { label: "🔥 BREAKING", className: "bg-red-600/20 text-red-400 border-red-600/40" },
  RISING: { label: "📈 RISING", className: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  VIRAL: { label: "🚀 VIRAL", className: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40" },
  POPULAR: { label: "👥 POPULAR", className: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  STABLE: { label: "📰 STABLE", className: "bg-neutral-700/30 text-neutral-400 border-neutral-600/40" },
};

function ageLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

const WARNING_MESSAGE: Record<string, string> = {
  no_live_data: "Pas assez de données récentes — لا توجد بيانات كافية حالياً",
  showing_cached: "Live sources are unreachable right now — showing the most recent cached results.",
  refresh_failed_showing_cached: "Refresh failed — showing the most recent cached results.",
};

export default function Dashboard() {
  const [country, setCountry] = useState("MA");
  const [category, setCategory] = useState<string | undefined>();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [sourceHealth, setSourceHealth] = useState<ProviderHealth[]>([]);
  const [warning, setWarning] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Trend | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = refresh ? await api.trends.refresh(country) : await api.trends.list({ country, category });
      setTrends(res.trends);
      setSourceHealth(res.sourceHealth);
      setWarning(res.warning);
      setGeneratedAt(res.generatedAt);
    } catch (e: any) {
      setError(e.message ?? "Failed to load trends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.trends.categories().then((r) => setCategories(r.categories));
  }, []);

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, category]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">
            🔥 Viral Now — {country === "MA" ? "Morocco & the World" : `${flagEmoji(country)} Worldwide pick`}
          </h1>
          {generatedAt && (
            <p className="text-xs text-neutral-500">Updated {new Date(generatedAt).toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMap((s) => !s)}
            className="bg-neutral-800 hover:bg-neutral-700 rounded-md px-3 py-1.5 text-sm"
          >
            🗺️ {showMap ? "Hide map" : "Choose country"}
          </button>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="bg-neutral-800 hover:bg-neutral-700 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {showMap && (
        <div className="mb-4">
          <WorldMapPicker value={country} onChange={setCountry} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setCategory(undefined)}
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            !category
              ? "bg-maroc-red border-maroc-red text-white"
              : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key === category ? undefined : c.key)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              category === c.key
                ? "bg-maroc-red border-maroc-red text-white"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
            }`}
          >
            {c.emoji} {c.labelEn}
          </button>
        ))}
      </div>

      <SourceHealthPanel sources={sourceHealth} />

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-md p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {!error && warning && (
        <div className="bg-amber-950/40 border border-amber-800 text-amber-300 rounded-md p-3 text-sm mb-4">
          {WARNING_MESSAGE[warning] ?? warning}
        </div>
      )}

      {!loading && trends.length === 0 && !error && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-6 text-center text-neutral-400">
          Pas assez de données récentes pour le moment.
          <br />
          لا توجد بيانات كافية حالياً.
          <br />
          <span className="text-xs">
            {category
              ? "Try a different category, or check \"Trend sources\" above."
              : "Check \"Trend sources\" above for why — it names exactly which source is down."}
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {trends.map((t, i) => {
          const typeStyle = TREND_TYPE_STYLE[t.trendType];
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="text-left bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md p-4 flex gap-4 items-center transition-colors"
            >
              <span className="text-neutral-600 font-bold text-lg w-6 text-center shrink-0">#{i + 1}</span>
              {t.imageUrl ? (
                <img src={t.imageUrl} alt="" className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-md bg-neutral-800 flex items-center justify-center text-2xl flex-shrink-0">
                  {t.categoryEmoji || "📰"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <ScoreBadge score={t.score} />
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeStyle.className}`}>
                    {typeStyle.label}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {t.categoryEmoji} {t.source}
                  </span>
                </div>
                <p className="font-medium truncate" dir="auto">{t.title}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {t.sourceCount} {t.sourceCount === 1 ? "source" : "sources"} · {ageLabel(t.ageMinutes)}
                  {t.velocityPerHour > 0 && <> · ↑ {t.velocityPerHour}/h</>}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && <TrendDetailModal trend={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
