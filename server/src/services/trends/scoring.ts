export interface ScorableTrend {
  title: string;
  publishedAt: Date | null;
  /** how many distinct outlets/feeds are already carrying this same story */
  duplicateCount?: number;
}

const EMOTIONAL_KEYWORDS: { category: string; weight: number; words: RegExp }[] = [
  { category: "outrage", weight: 22, words: /(scandale|colère|indign|احتجاج|فضيحة|غضب)/i },
  { category: "shock", weight: 20, words: /(choc|dramatique|mort|accident|صدمة|وفاة|حادث)/i },
  { category: "national-pride", weight: 17, words: /(maroc|marocain|drapeau|المغرب|مغربي|منتخب)/i },
  { category: "sports", weight: 14, words: /(foot|match|but|championnat|كرة|مباراة|هدف)/i },
  { category: "celebrity", weight: 11, words: /(star|célébrité|artiste|فنان|نجم|مشهور)/i },
  { category: "humor", weight: 9, words: /(insolite|drôle|humour|طريف|مضحك)/i },
];

/** Recency decay: fresh news scores near 1.0, decaying toward 0 after ~48h. */
function recencyFactor(publishedAt: Date | null): number {
  if (!publishedAt) return 0.5;
  const hours = (Date.now() - publishedAt.getTime()) / 3_600_000;
  if (hours <= 0) return 1;
  const halfLifeHours = 18;
  return Math.max(0, Math.pow(0.5, hours / halfLifeHours));
}

function emotionalScore(title: string): { score: number; category: string } {
  for (const e of EMOTIONAL_KEYWORDS) {
    if (e.words.test(title)) return { score: e.weight, category: e.category };
  }
  return { score: 6, category: "general" };
}

/**
 * RSS feeds don't give us real engagement numbers (shares/comments), so
 * "momentum" is approximated from how many outlets are already carrying the
 * same story, split into two opposing effects:
 *  - a small, quickly-capped bonus for the first couple of corroborating
 *    outlets (independent validation this is a real, currently-breaking story)
 *  - a penalty that only kicks in once *many* outlets have it (posting now
 *    adds little novelty)
 */
function corroborationBonus(duplicateCount: number): number {
  return Math.min(8, duplicateCount * 4);
}

function saturationPenalty(duplicateCount: number): number {
  return Math.min(15, Math.max(0, duplicateCount - 3) * 3);
}

export interface ScoreResult {
  score: number; // 0-100
  explanation: string;
}

export function scoreTrend(t: ScorableTrend): ScoreResult {
  const recency = recencyFactor(t.publishedAt); // 0..1
  const { score: emoScore, category } = emotionalScore(t.title);
  const duplicateCount = t.duplicateCount ?? 0;
  const corroboration = corroborationBonus(duplicateCount);
  const saturation = saturationPenalty(duplicateCount);

  const base = recency * 50 + emoScore + corroboration;
  const score = Math.max(0, Math.min(100, Math.round(base - saturation)));

  const corroborationLabel =
    duplicateCount === 0 ? "single source" : duplicateCount <= 2 ? "corroborated" : "widely covered";
  const saturationLabel = saturation > 0 ? "high saturation" : "low saturation";
  const recencyLabel = recency > 0.7 ? "very fresh" : recency > 0.3 ? "recent" : "aging";

  const emoji = score >= 70 ? "🔥" : score >= 40 ? "📈" : "🕓";
  const explanation = `${emoji} ${recencyLabel}, ${corroborationLabel}, ${saturationLabel}, ${category.replace("-", " ")} appeal`;

  return { score, explanation };
}
