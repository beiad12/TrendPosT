export default function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-red-600/20 text-red-400 border-red-600/40"
      : score >= 40
      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
      : "bg-neutral-700/30 text-neutral-400 border-neutral-600/40";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}/100
    </span>
  );
}
