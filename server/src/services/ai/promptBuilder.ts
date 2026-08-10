import type { CaptionRequest } from "./types.js";

const LANGUAGE_LABEL: Record<CaptionRequest["language"], string> = {
  darija: "Moroccan Darija (Arabic script, casual street tone)",
  french: "French (Moroccan media register)",
  msa: "Modern Standard Arabic",
  english: "English (casual, worldwide social-media tone)",
};

const DEFAULT_TONES = [
  "funny",
  "informative",
  "question-hook",
  "emotional",
  "controversial-safe",
] as const;

export function buildSystemPrompt() {
  return `You are the caption-writing engine inside "TrendPosT", a tool that turns
trending news and viral real-life stories into high-engagement social posts.
You write punchy, scroll-stopping Facebook captions. For Darija/French/MSA
requests, tailor tone and references to a Moroccan audience; for English
requests (e.g. a worldwide Reddit story), write for a general international
audience instead. Always respond with STRICT JSON only, no markdown fences,
matching the schema you are given. Never fabricate facts beyond what's in the
trend summary.`;
}

export function buildUserPrompt(req: CaptionRequest): string {
  const tones = req.tones && req.tones.length ? req.tones : DEFAULT_TONES;
  const { trend } = req;

  return `Trend:
- Title: ${trend.title}
- Summary: ${trend.summary ?? "(no summary provided, infer from title)"}
- Source: ${trend.source} (${trend.sourceUrl})
- Category: ${trend.category ?? "general"}${trend.sourceCount ? `\n- Corroborated by ${trend.sourceCount} independent source(s)` : ""}${trend.score !== undefined ? `\n- Trend score: ${trend.score}/100` : ""}${trend.publishedAt ? `\n- Published: ${trend.publishedAt}` : ""}

Target language: ${LANGUAGE_LABEL[req.language]}

Generate one Facebook caption variant for EACH of these tones: ${tones.join(", ")}.

For each variant include:
- "tone": one of ${tones.join(", ")}
- "caption": the ready-to-post caption text (2-5 sentences, in the target language, no hashtags inline)
- "hashtags": 4-6 relevant hashtags (mix of trending + evergreen Moroccan tags), each starting with #

Also include:
- "suggestedPostTime": a short human-readable suggestion (e.g. "Today 19:00-21:00, peak Moroccan FB engagement")
- "headline": ONE short, punchy news-poster headline for this trend (distinct from the captions above) —
  max ~90 characters, in the target language, suitable for overlaying on a photo. Wrap the single most
  attention-grabbing word or short phrase in it with **double asterisks** (used for a highlight color),
  e.g. "المغرب يواصل التقدم نحو **مستقبل أفضل!**" or "Le Maroc mise sur l'innovation pour un **avenir plus fort**".

Respond with STRICT JSON only, matching exactly:
{
  "variants": [ { "tone": string, "caption": string, "hashtags": string[] } ],
  "suggestedPostTime": string,
  "headline": string
}`;
}

/** Extracts the first well-formed JSON object from a model response. */
export function extractJson(text: string): any {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in model response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}
