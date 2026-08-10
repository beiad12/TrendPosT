import { CATEGORIES } from "../trends/config.js";

export interface TrendSummary {
  title: string;
  description?: string | null;
  categoryKey?: string;
}

const CATEGORY_FALLBACK_QUERY: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.labelEn])
);

/**
 * Queries for the web image search fallback, most specific first: the
 * actual headline (works well when the story itself is visually generic —
 * a product launch, a stadium, a landmark), then a category-level fallback
 * so *something* relevant still turns up when the headline is too
 * narrative/specific for a stock-photo search to match. Weather gets its
 * own dedicated query since "storm hits city X" rarely matches stock photo
 * tags the way "weather storm sky clouds" does.
 */
export function buildWebSearchQueries(trend: TrendSummary): string[] {
  if (trend.categoryKey === "weather") {
    return [`${trend.title} weather`, "weather storm sky clouds forecast"];
  }
  const queries = [trend.title];
  const fallback = trend.categoryKey ? CATEGORY_FALLBACK_QUERY[trend.categoryKey] : undefined;
  if (fallback) queries.push(fallback);
  return queries;
}

/**
 * The AI image-generation prompt — used only once a real photo (the
 * trend's own source, and the web search fallback) couldn't be found.
 * Explicitly steers away from fabricated readable text/signage/logos in
 * the image (a common AI-image artifact) and toward a real photojournalism
 * look rather than an obviously illustrated/stylized one, since this is
 * standing in for a real news photo.
 */
export function buildAiImagePrompt(trend: TrendSummary): string {
  const context = trend.description?.trim() ? `${trend.title}. ${trend.description}` : trend.title;

  if (trend.categoryKey === "weather") {
    return `A photorealistic press photograph capturing this weather event: ${context}. Dramatic natural sky and lighting, real photojournalism style, wide shot, no text, no watermarks, no logos, no fabricated signage.`;
  }

  return `A photorealistic press/news photograph illustrating: ${context}. Real photojournalism style, natural lighting, no text, no watermarks, no logos, no fabricated readable signage, no people's faces in unrealistic close-up.`;
}
