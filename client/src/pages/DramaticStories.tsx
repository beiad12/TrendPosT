import { useEffect, useState } from "react";
import { api, Trend } from "../lib/api.js";
import ScoreBadge from "../components/ScoreBadge.js";
import TrendDetailModal from "../components/TrendDetailModal.js";

function ageLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

/**
 * Worldwide, real-story feed — deliberately separate from the Morocco/world
 * news Dashboard: real first-person Reddit posts (TIFU, relationship drama,
 * revenge, entitled-parent stories, etc.), ranked by Reddit's own
 * engagement, no country picker. Opens the same TrendDetailModal as the
 * Dashboard, but pre-set to the "Dramatic Story" poster style and English
 * captions, since that's what these stories actually are.
 */
export default function DramaticStories() {
  const [stories, setStories] = useState<Trend[]>([]);
  const [configured, setConfigured] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Trend | null>(null);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.trends.dramaticStories(refresh);
      setStories(res.stories);
      setConfigured(res.configured);
      setUsingFallback(res.usingFallback);
      setReason(res.reason);
      setGeneratedAt(res.generatedAt);
    } catch (e: any) {
      setError(e.message ?? "Failed to load dramatic stories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">🎬 Dramatic Stories — Worldwide</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Real, first-person stories from Reddit — not Morocco-scoped. Pick one and turn it into a poster.
          </p>
          {generatedAt && (
            <p className="text-xs text-neutral-500 mt-1">Updated {new Date(generatedAt).toLocaleTimeString()}</p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="bg-neutral-800 hover:bg-neutral-700 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-md p-3 text-sm mb-4">{error}</div>
      )}

      {!configured && (
        <div className="bg-amber-950/40 border border-amber-800 text-amber-300 rounded-md p-3 text-sm mb-4">
          {reason ?? "Couldn't reach Reddit right now."} Reddit is currently the only source this feed pulls real stories
          from.
        </div>
      )}

      {configured && usingFallback && (
        <div className="bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-md p-2.5 text-xs mb-4">
          Using Reddit's public feed (no API key needed) — this can occasionally rate-limit. Add{" "}
          <code className="text-neutral-300">REDDIT_CLIENT_ID</code> + <code className="text-neutral-300">REDDIT_CLIENT_SECRET</code>{" "}
          in Settings for a more reliable connection, but it's entirely optional.
        </div>
      )}

      {!loading && configured && stories.length === 0 && !error && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-6 text-center text-neutral-400">
          No stories fetched yet — try Refresh.
        </div>
      )}

      <div className="grid gap-3">
        {stories.map((t, i) => (
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
                🎬
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <ScoreBadge score={t.score} />
                <span className="text-xs text-neutral-500">{t.source}</span>
              </div>
              <p className="font-medium truncate">{t.title}</p>
              <p className="text-xs text-neutral-400 mt-1">{t.scoreExplanation} · {ageLabel(t.ageMinutes)}</p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <TrendDetailModal
          trend={selected}
          onClose={() => setSelected(null)}
          defaultLanguage="english"
          defaultStyle="dramatic"
        />
      )}
    </div>
  );
}
