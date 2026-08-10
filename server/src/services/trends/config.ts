// Centralized trend-engine configuration — every source URL, query list,
// scoring weight, and provider on/off switch lives here, not scattered
// across provider files. This is the "one place to look" the spec asks for.

export interface QueryGroup {
  key: string;
  label: string;
  /** A Google News `hl` code — "ar"/"fr"/"en" for the curated Morocco groups below, but any hl Google News accepts for a dynamically-built country query group (see buildCountryQueryGroup). */
  language: string;
  country: string;
  categoryHint: string;
  queries: string[];
}

/**
 * Google News' RSS *search* endpoint (news.google.com/rss/search) is a
 * different, still-functioning endpoint from the old, now-dead
 * "trendingsearches/daily/rss" one — this is the real fix, not a
 * find-and-replace of the broken URL. hl/gl/ceid steer it toward
 * Moroccan French/Arabic results.
 */
export const GOOGLE_NEWS_QUERY_GROUPS: QueryGroup[] = [
  {
    key: "morocco-ar",
    label: "Google News — المغرب",
    language: "ar",
    country: "MA",
    categoryHint: "morocco",
    queries: [
      "المغرب", "أخبار المغرب", "المغرب اليوم", "عاجل المغرب", "الرباط",
      "الدار البيضاء", "مراكش", "طنجة", "فاس", "أكادير", "وجدة", "الناظور", "تطوان",
    ],
  },
  {
    key: "morocco-fr",
    label: "Google News — Maroc",
    language: "fr",
    country: "MA",
    categoryHint: "morocco",
    queries: [
      "Maroc", "actualité Maroc", "Maroc aujourd'hui", "Maroc urgent",
      "Rabat", "Casablanca", "Marrakech", "Tanger", "Fès", "Agadir", "Oujda",
    ],
  },
  {
    key: "morocco-viral",
    label: "Google News — Maroc viral",
    language: "fr",
    country: "MA",
    categoryHint: "viral",
    queries: [
      "Maroc viral", "buzz Maroc", "actualité virale Maroc", "polémique Maroc",
      "tendance Maroc", "réseaux sociaux Maroc",
    ],
  },
  {
    key: "morocco-sports",
    label: "Google News — Sport marocain",
    language: "fr",
    country: "MA",
    categoryHint: "sports",
    queries: [
      "Maroc football", "équipe nationale Maroc", "Lions de l'Atlas", "Wydad",
      "Raja", "AS FAR", "football marocain",
    ],
  },
  {
    key: "morocco-international",
    label: "Google News — Maroc International",
    language: "fr",
    country: "MA",
    categoryHint: "world",
    queries: [
      "Maroc France", "Maroc Espagne", "Maroc Algérie", "Maroc Afrique",
      "Moroccans", "Morocco international",
    ],
  },
];

import type { Country } from "./countries.js";

/**
 * Builds a generic query group for an arbitrary country (the map/country
 * picker) — the same shape as the hand-curated Morocco groups above, but
 * generated from the country's name rather than a curated keyword list
 * (writing bespoke Arabic/French-style keyword sets for 170+ countries
 * isn't practical by hand; these generic English-pattern queries work
 * reasonably well against Google News for any country).
 */
export function buildCountryQueryGroup(country: Country): QueryGroup {
  return {
    key: `country-${country.code}`,
    label: `Google News — ${country.name}`,
    language: country.language as QueryGroup["language"],
    country: country.code,
    categoryHint: "world",
    queries: [
      country.name,
      `${country.name} news`,
      `${country.name} today`,
      `breaking news ${country.name}`,
      `${country.name} sports`,
      `${country.name} viral`,
    ],
  };
}

/** Recognized Moroccan publishers — used for source-domain corroboration weighting, not as direct RSS endpoints. */
export const KNOWN_MOROCCAN_PUBLISHERS = [
  "hespress.com", "le360.ma", "h24info.ma", "akhbarona.com", "map.ma",
  "lopinion.ma", "telquel.ma", "medias24.com", "moroccoworldnews.com",
  "2m.ma", "snrt.ma", "alahdath.info", "chouftv.ma",
];

export interface CategoryDef {
  key: string;
  label: string; // Arabic
  labelEn: string; // English/French display label
  emoji: string;
  keywords: RegExp;
  /** 0..1 — how strongly this category itself signals "worth posting" (feeds the small category component of the score). */
  importance: number;
}

/**
 * The dashboard's category taxonomy, classified by keyword match against
 * title+description. Order matters — first match wins, so more specific
 * categories are checked before broad catch-alls. `viral` is special: it's
 * primarily assigned by source (a Reddit-sourced story — see
 * scoring.ts#classifyCategory's `preferViral` flag), with these keywords
 * as a fallback for non-Reddit "this is explicitly described as viral"
 * stories.
 */
export const CATEGORIES: CategoryDef[] = [
  { key: "breaking", label: "عاجل", labelEn: "Breaking", emoji: "🔥", importance: 1, keywords: /(عاجل|breaking|urgent|dernière minute)/i },
  { key: "incidents", label: "حوادث", labelEn: "Incidents", emoji: "🚨", importance: 0.85, keywords: /(حادث|حادثة|وفاة|جريمة|اعتقال|accident|crime|meurtre|arrestation|incendie|drame)/i },
  { key: "military", label: "عسكري", labelEn: "Military", emoji: "🎖️", importance: 0.8, keywords: /(عسكري|جيش|قوات|صواريخ|حرب|غزو|militaire|armée|guerre|missile|troops|military|invasion|conflit armé)/i },
  { key: "weather", label: "طقس", labelEn: "Weather", emoji: "🌦️", importance: 0.7, keywords: /(طقس|أمطار|فيضانات|زلزال|météo|pluie|inondation|séisme|tempête|canicule)/i },
  { key: "politics", label: "سياسة", labelEn: "Politics", emoji: "🏛️", importance: 0.65, keywords: /(سياسة|حكومة|وزير|برلمان|انتخابات|رئيس|politique|gouvernement|ministre|parlement|élections|president|président)/i },
  { key: "sports", label: "الرياضة", labelEn: "Sports", emoji: "⚽", importance: 0.9, keywords: /(رياضة|كرة القدم|مباراة|منتخب|فريق|sport|football|match|équipe|championnat)/i },
  { key: "celebrity", label: "مشاهير", labelEn: "Celebrity", emoji: "🌟", importance: 0.75, keywords: /(مشهور|نجم|مشاهير|فضيحة نجم|celebrity|célébrité|famous|paparazzi)/i },
  { key: "entertainment", label: "فن وترفيه", labelEn: "Entertainment", emoji: "🎭", importance: 0.7, keywords: /(فنان|فنانة|مسلسل|فيلم|أغنية|artiste|film|série|chanson|concert)/i },
  { key: "viral", label: "فيروسي", labelEn: "Viral & Reddit", emoji: "🐸", importance: 0.7, keywords: /(فيروسي|منتشر|تريند|viral|buzz|tendance|trending|meme|ميم)/i },
  { key: "life-stories", label: "قصص حياة", labelEn: "Life Stories", emoji: "📖", importance: 0.6, keywords: /(قصة ملهمة|قصة مؤثرة|قصة إنسانية|touching story|inspiring story|human interest|histoire inspirante|survivor story|miracle story)/i },
  { key: "economy", label: "اقتصاد", labelEn: "Economy", emoji: "💰", importance: 0.6, keywords: /(اقتصاد|بورصة|استثمار|ميزانية|économie|bourse|investissement|budget|prix|inflation)/i },
  { key: "health", label: "صحة", labelEn: "Health", emoji: "🏥", importance: 0.6, keywords: /(صحة|علاج|مرض|طبي|وباء|santé|maladie|traitement|médical|épidémie)/i },
  { key: "technology", label: "تكنولوجيا", labelEn: "Technology", emoji: "💻", importance: 0.55, keywords: /(تكنولوجيا|تقنية|ذكاء اصطناعي|technologie|application|intelligence artificielle|numérique)/i },
  { key: "development", label: "مشاريع وتنمية", labelEn: "Development", emoji: "🏗️", importance: 0.65, keywords: /(مشروع|بنية تحتية|تنمية|projet|infrastructure|développement|inauguration|chantier)/i },
  { key: "society", label: "مجتمع", labelEn: "Society", emoji: "❤️", importance: 0.5, keywords: /(مجتمع|تعليم|société|éducation|social)/i },
  { key: "world", label: "العالم", labelEn: "World", emoji: "🌍", importance: 0.4, keywords: /(العالم|دولي|international|monde|étranger)/i },
  { key: "morocco", label: "عام", labelEn: "General", emoji: "📰", importance: 0.6, keywords: /./ }, // catch-all default (key kept for backward compat with existing filters/tests)
];

/** Viral-potential signal categories — mirrors what actually spreads on Facebook, weighted by strength. */
export const VIRAL_SIGNALS: { category: string; weight: number; words: RegExp }[] = [
  { category: "outrage", weight: 10, words: /(scandale|colère|indign|احتجاج|فضيحة|غضب)/i },
  { category: "shock", weight: 10, words: /(choc|dramatique|صدمة|مفاجأة|drame)/i },
  { category: "breaking", weight: 9, words: /(عاجل|breaking|urgent|dernière minute)/i },
  { category: "national-pride", weight: 8, words: /(المغرب يفوز|بطولة|إنجاز|record|exploit|victoire du maroc|منتخب)/i },
  { category: "crime", weight: 8, words: /(جريمة|مقتل|وفاة|accident|حادث|مصرع|meurtre)/i },
  { category: "celebrity", weight: 6, words: /(فنان|نجم|مشهور|star|célébrité|artiste)/i },
  { category: "money", weight: 5, words: /(أموال|ثروة|مليون|مليار|argent|millions|budget)/i },
  { category: "weather-event", weight: 5, words: /(فيضانات|زلزال|عاصفة|inondation|séisme|tempête|canicule)/i },
  { category: "humor", weight: 4, words: /(insolite|drôle|humour|طريف|مضحك)/i },
  { category: "tech", weight: 3, words: /(ذكاء اصطناعي|intelligence artificielle|تطبيق جديد)/i },
];

/** High relevance: the story is directly about Morocco/Moroccans (place, institution, team, person). */
export const MOROCCO_HIGH_RELEVANCE = /(maroc|marocain|morocco|moroccan|المغرب|مغرب|مغربي|الرباط|rabat|casablanca|الدار البيضاء|دار البيضاء|marrakech|مراكش|tanger|tangier|طنجة|f[eè]s|fez|فاس|agadir|أكادير|oujda|وجدة|t[ée]touan|تطوان|nador|الناظور|wydad|وداد|\braja\b|رجاء|as far|lions de l'atlas|أسود الأطلس|منتخب المغرب)/i;

/** Medium relevance: an international story that names Morocco alongside another country/region (bilateral, diplomatic, regional). */
export const MOROCCO_MEDIUM_RELEVANCE = /(france|espagne|spain|algérie|algeria|afrique|africa)/i;

export interface ScoreWeights {
  freshness: number;
  sourceCount: number;
  velocity: number;
  moroccoRelevance: number;
  social: number;
  category: number;
  viralPotential: number;
}

/** Sums to 100 — the weight given to each factor of the 0-100 trend score. Tune here, not inline in scoring.ts. */
export const SCORE_WEIGHTS: ScoreWeights = {
  freshness: 20,
  sourceCount: 20,
  velocity: 20,
  moroccoRelevance: 15,
  social: 10,
  category: 5,
  viralPotential: 10,
};

export interface ProviderToggle {
  enabled: boolean;
  reason?: string;
}

/**
 * Central provider on/off switches. Reddit and Google Trends read live env
 * vars so they self-report "not_configured" rather than failing, without
 * needing a code change to disable them.
 */
export const PROVIDERS_CONFIG: Record<string, ProviderToggle> = {
  googleNews: { enabled: true },
  gdelt: { enabled: true },
  publisherRss: { enabled: true },
  reddit: {
    enabled: Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
    reason: "Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET",
  },
  // The old googleTrends "trendingsearches/daily/rss" endpoint is dead
  // (404) and there's no free replacement -- left disabled rather than
  // pointed at a fake source. See providers/googleTrends.ts.
  googleTrends: { enabled: false, reason: "No working free endpoint; needs a paid Trends API integration" },
};

export const CACHE_TTL_MS: Record<string, number> = {
  googleNews: 7 * 60 * 1000,
  gdelt: 12 * 60 * 1000,
  publisherRss: 5 * 60 * 1000,
  reddit: 10 * 60 * 1000,
  default: 5 * 60 * 1000,
};

/** How long a failed provider is skipped before being retried (exponential, capped). */
export const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];

/** Articles older than this are dropped from clustering entirely, unless a cluster containing them is still actively growing. */
export const MAX_ARTICLE_AGE_HOURS = 48;

/** How long raw articles are retained in the DB before cleanup. */
export const ARTICLE_RETENTION_HOURS = 72;
