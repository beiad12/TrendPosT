import { useEffect, useState } from "react";
import { api, Trend } from "../lib/api.js";
import ScoreBadge from "../components/ScoreBadge.js";
import TrendDetailModal from "../components/TrendDetailModal.js";

export default function Dashboard() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Trend | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.trends.list(refresh);
      setTrends(res.trends);
      setFetchedAt(res.fetchedAt);
    } catch (e: any) {
      setError(e.message ?? "Failed to load trends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Trending in Morocco</h1>
          {fetchedAt && (
            <p className="text-xs text-neutral-500">Updated {new Date(fetchedAt).toLocaleTimeString()}</p>
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
        <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-md p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && trends.length === 0 && !error && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-6 text-center text-neutral-400">
          No trends fetched yet. This can happen if outbound network access to the configured RSS
          feeds is unavailable in this environment — the discovery pipeline is wired and will
          populate automatically once feeds are reachable.
        </div>
      )}

      <div className="grid gap-3">
        {trends.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="text-left bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md p-4 flex gap-4 items-center transition-colors"
          >
            {t.imageUrl ? (
              <img src={t.imageUrl} alt="" className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-md bg-neutral-800 flex items-center justify-center text-neutral-600 flex-shrink-0">
                📰
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <ScoreBadge score={t.score} />
                <span className="text-xs text-neutral-500">{t.source}</span>
              </div>
              <p className="font-medium truncate">{t.title}</p>
              <p className="text-xs text-neutral-400 mt-1">{t.scoreExplanation}</p>
            </div>
          </button>
        ))}
      </div>

      {selected && <TrendDetailModal trend={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
