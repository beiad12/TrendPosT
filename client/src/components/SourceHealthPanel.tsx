import { ProviderHealth, ProviderHealthStatus } from "../lib/api.js";

const STATUS_DOT: Record<ProviderHealthStatus, string> = {
  healthy: "🟢",
  degraded: "🟡",
  unavailable: "🔴",
  not_configured: "⚪",
};

const STATUS_LABEL: Record<ProviderHealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unavailable: "Unavailable",
  not_configured: "Not configured",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/** Developer/admin panel (spec §32): per-source health, without exposing raw errors to normal users unless they open this panel themselves. */
export default function SourceHealthPanel({ sources }: { sources: ProviderHealth[] }) {
  if (sources.length === 0) return null;

  return (
    <details className="bg-neutral-900 border border-neutral-800 rounded-md mb-4">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-neutral-400 hover:text-neutral-200">
        Trend sources ({sources.filter((s) => s.status === "healthy").length}/{sources.length} healthy)
      </summary>
      <div className="px-4 pb-4 pt-1 grid gap-1.5">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-xs py-1 border-t border-neutral-800/60 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2 min-w-0">
              <span>{STATUS_DOT[s.status]}</span>
              <span className="font-medium truncate">{s.name}</span>
              <span className="text-neutral-500">{STATUS_LABEL[s.status]}</span>
            </div>
            <div className="text-neutral-500 flex gap-3 shrink-0">
              {s.status === "healthy" || s.status === "degraded" ? (
                <>
                  <span>{s.itemsFetched} fetched</span>
                  {s.latencyMs !== null && <span>{s.latencyMs}ms</span>}
                  <span>updated {timeAgo(s.lastSuccess)}</span>
                </>
              ) : s.status === "unavailable" ? (
                <span title={s.lastError ?? undefined}>last error {timeAgo(s.lastFailure)}</span>
              ) : (
                <span>{s.lastError ?? "optional"}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
