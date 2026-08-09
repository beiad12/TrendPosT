export interface ScorableTrend {
  title: string;
  publishedAt: Date | null;
  /** how many distinct sources/pages are already carrying this story */
  duplicateCount?: number;
  /** rough engagement signal if available (shares, comments, retweets...) */
  engagement?: number;
}

const EMOTIONAL_KEYWORDS: { category: string; weight: number; words: RegExp }[] = [
  { category: "outrage", weight: 18, words: /(scandale|colère|indign|احتجاج|فضيحة|غضب)/i },
  { category: "shock", weight: 16, words: /(choc|dramatique|mort|accident|صدمة|وفاة|حادث)/i },
  { category: "national-pride", weight: 15, words: /(maroc|marocain|drapeau|المغرب|مغربي|منتخب)/i },
  { category: "sports", weight: 12, words: /(foot|match|but|championnat|كرة|مباراة|هدف)/i },
  { category: "celebrity", weight: 10, words: /(star|célébrité|artiste|فنان|نجم|مشهور)/i },
  { category: "humor", weight: 8, words: /(insolite|drôle|humour|طريف|مضحك)/i },
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
  return { score: 5, category: "general" };
}

function saturationPenalty(duplicateCount: number): number {
  // Each additional outlet already covering the story reduces novelty.
  return Math.min(20, duplicateCount * 4);
}

export interface ScoreResult {
  score: number; // 0-100
  explanation: string;
}

export function scoreTrend(t: ScorableTrend): ScoreResult {
  const recency = recencyFactor(t.publishedAt); // 0..1
  const { score: emoScore, category } = emotionalScore(t.title);
  const momentum = Math.min(25, Math.log10((t.engagement ?? 0) + 1) * 10);
  const saturation = saturationPenalty(t.duplicateCount ?? 0);

  const base = recency * 45 + emoScore + momentum;
  const score = Math.max(0, Math.min(100, Math.round(base - saturation)));

  const momentumLabel =
    momentum > 15 ? "rising fast" : momentum > 5 ? "steady momentum" : "low momentum";
  const saturationLabel =
    saturation > 10 ? "high saturation" : saturation > 0 ? "some saturation" : "low saturation";
  const recencyLabel = recency > 0.7 ? "very fresh" : recency > 0.3 ? "recent" : "aging";

  const emoji = score >= 70 ? "🔥" : score >= 40 ? "📈" : "🕓";
  const explanation = `${emoji} ${recencyLabel}, ${momentumLabel}, ${saturationLabel}, ${category.replace("-", " ")} appeal`;

  return { score, explanation };
}
