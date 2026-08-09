import { ScoreBreakdown } from "../lib/api.js";

const ROWS: { key: keyof Omit<ScoreBreakdown, "total">; label: string; max: number }[] = [
  { key: "freshness", label: "Freshness", max: 20 },
  { key: "sourceCount", label: "Sources", max: 20 },
  { key: "velocity", label: "Velocity", max: 20 },
  { key: "moroccoRelevance", label: "Morocco", max: 15 },
  { key: "social", label: "Social", max: 10 },
  { key: "category", label: "Category", max: 5 },
  { key: "viralPotential", label: "Viral Potential", max: 10 },
];

/** Makes the 0-100 ranking explainable (spec §24) instead of a black-box number. */
export default function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <details className="bg-neutral-950 border border-neutral-800 rounded-md mb-4">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200">
        Trend Score: {breakdown.total}/100 — why?
      </summary>
      <div className="px-3 pb-3 pt-1 grid gap-1">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-28 text-neutral-400 shrink-0">{r.label}</span>
            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-maroc-red rounded-full"
                style={{ width: `${Math.min(100, (breakdown[r.key] / r.max) * 100)}%` }}
              />
            </div>
            <span className="w-14 text-right text-neutral-300 shrink-0">
              {breakdown[r.key]}/{r.max}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
