import { createHash } from "node:crypto";

const FRENCH_STOPWORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "au", "aux", "en",
  "dans", "pour", "sur", "avec", "par", "ce", "cet", "cette", "ces", "que",
  "qui", "est", "sont", "a", "au", "ne", "pas", "il", "elle", "ils", "elles",
]);

const ARABIC_STOPWORDS = new Set([
  "في", "من", "إلى", "على", "عن", "مع", "أن", "إن", "ما", "لا", "هذا",
  "هذه", "ذلك", "التي", "الذي", "و", "أو", "كما", "بعد", "قبل", "بين",
]);

/** Strips Arabic diacritics (tashkeel), tatweel, and normalizes letter variants that mean the same word for comparison purposes (never for display). */
function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٰٟ]/g, "") // diacritics
    .replace(/ـ/g, "") // tatweel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/** Strips French/Latin accents (NFD decompose + drop combining marks) for comparison purposes. */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normalizes a title for internal comparison (deduplication, clustering) —
 * never used for what's actually displayed to the user. Lowercases,
 * strips accents/diacritics, strips punctuation, collapses whitespace,
 * and removes common stopwords so near-identical headlines with reordered
 * words still compare equal-ish.
 */
export function normalizeTitleForComparison(title: string): string {
  let t = title.trim();
  t = normalizeArabic(t);
  t = stripAccents(t);
  t = t.toLowerCase();
  t = t.replace(/[^\p{L}\p{N}\s]/gu, " "); // strip punctuation, keep letters/numbers/whitespace (any script)
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Very light stemming, comparison-only (never shown to a user): Arabic
 * headlines routinely inflect the same word with a case/tanween ending
 * spelled out as a plain alef ("مشروعاً"/"مشروعا" vs "مشروع" — "a project"
 * in accusative vs bare form) which plain diacritic-stripping doesn't
 * touch since it's a real letter, not a removable mark. Left unstemmed,
 * near-duplicate Arabic headlines about the same story can fall just
 * under the clustering similarity threshold. A trailing bare "s" is
 * stripped the same way for French plurals.
 */
function lightStem(word: string): string {
  if (/[؀-ۿ]/.test(word) && word.length > 3 && word.endsWith("ا")) {
    return word.slice(0, -1);
  }
  if (/^[a-z]+$/.test(word) && word.length > 4 && word.endsWith("s")) {
    return word.slice(0, -1);
  }
  return word;
}

/** Tokenizes a normalized title into a stopword-free, lightly-stemmed word set, for similarity comparison. */
export function titleTokens(title: string): Set<string> {
  const normalized = normalizeTitleForComparison(title);
  const words = normalized.split(" ").filter(Boolean).map(lightStem).filter((w) => w.length > 1);
  return new Set(words.filter((w) => !FRENCH_STOPWORDS.has(w) && !ARABIC_STOPWORDS.has(w)));
}

/** Jaccard similarity between two token sets (0..1). */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const TRACKING_PARAM_PREFIXES = ["utm_", "fbclid", "gclid", "mc_", "ref", "ref_src", "spm", "igshid"];

/** Strips tracking params and the fragment from a URL so the same article via different links dedupes correctly. Falls back to the raw string if it isn't a parseable URL. */
export function cleanUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAM_PREFIXES.some((p) => lower === p || lower.startsWith(p))) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    let s = url.toString();
    if (s.endsWith("?")) s = s.slice(0, -1);
    return s;
  } catch {
    return rawUrl;
  }
}

/** Extracts the registrable-ish domain (drops "www.") for source-counting and dedup. */
export function domainFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Stable short id derived from a URL — same article fetched twice (even by two providers) gets the same id. */
export function stableIdFromUrl(rawUrl: string): string {
  return createHash("sha1").update(cleanUrl(rawUrl)).digest("hex").slice(0, 20);
}
