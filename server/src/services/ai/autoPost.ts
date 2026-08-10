import { generateCaptions } from "./router.js";
import { renderPost } from "../render/renderEngine.js";
import { getTemplateById, getTemplateByName } from "../templateStore.js";
import { PRESS_POSTER_TEMPLATE_NAME } from "../seedTemplates.js";
import { getWatermarkOption } from "../brandingStore.js";
import { searchWebImage } from "../media/webImageSearch.js";
import { generateAiImage } from "../media/aiImageGen.js";
import { buildWebSearchQueries, buildAiImagePrompt } from "../media/imagePrompt.js";
import type { CaptionRequest } from "./types.js";

/** A client-input problem (missing photo, unknown template) — the route maps this to 400, not 502. */
export class AutoPostInputError extends Error {}

export interface AutoPostRequest {
  trend: CaptionRequest["trend"] & { imageUrl?: string | null };
  provider: CaptionRequest["provider"];
  language: CaptionRequest["language"];
  /** Defaults to the seeded "AI Auto Post" (photo + headline) template. */
  templateId?: string;
}

export type PhotoSource = "provided" | "web-search" | "ai-generated";

export interface AutoPostResult {
  headline: string;
  caption: string;
  hashtags: string[];
  suggestedPostTime?: string;
  image: Buffer;
  photoSource: PhotoSource;
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch failed (${resp.status})`);
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * Resolves a photo for the trend through a real-photo-first fallback
 * chain — never fabricates a photo when a real one is findable:
 *   1. The trend's own source photo (imageUrl), if it has one and it's
 *      still reachable.
 *   2. A web image search (Unsplash, if configured) — the actual
 *      headline first, then a category-level query (weather gets its own
 *      dedicated query, e.g. "weather storm sky clouds", since a literal
 *      news headline rarely matches stock-photo tags).
 *   3. AI-generated imagery (OpenAI DALL-E, if an OpenAI key is
 *      configured) as the last resort, with a category-aware prompt.
 * Throws only once every option has genuinely been exhausted.
 */
async function resolvePhoto(trend: AutoPostRequest["trend"]): Promise<{ buffer: Buffer; source: PhotoSource }> {
  const summary = { title: trend.title, description: trend.summary, categoryKey: trend.category };

  if (trend.imageUrl) {
    try {
      return { buffer: await fetchAsBuffer(trend.imageUrl), source: "provided" };
    } catch (err) {
      console.log(`[AutoPost] provided photo unreachable (${(err as Error)?.message}) — falling back`);
    }
  }

  const webUrl = await searchWebImage(buildWebSearchQueries(summary));
  if (webUrl) {
    try {
      return { buffer: await fetchAsBuffer(webUrl), source: "web-search" };
    } catch (err) {
      console.log(`[AutoPost] web-search photo unreachable (${(err as Error)?.message}) — falling back`);
    }
  }

  try {
    return { buffer: await generateAiImage(buildAiImagePrompt(summary)), source: "ai-generated" };
  } catch (err) {
    console.log(`[AutoPost] AI image generation failed: ${(err as Error)?.message}`);
  }

  throw new AutoPostInputError(
    "This trend has no photo, no matching photo was found on the web, and AI image generation failed too " +
      "(Pollinations, the free no-key AI generator, is tried automatically — it may be temporarily unavailable; " +
      "add an OpenAI key in Settings for a second AI option, or a free Unsplash/Pexels key to widen the web search) " +
      "— pick a trend with a photo, or use the manual Templates flow."
  );
}

/**
 * The end-to-end AI pipeline: resolves a photo for the trend (its own
 * source photo, a web search, or AI-generated as a last resort — see
 * resolvePhoto), has the AI write a punchy headline for it, and renders
 * the two together — no manual photo upload or manual text entry
 * required. This is the "nothing without AI" flow: everything but the
 * template's fixed layout comes from the trend + the AI.
 */
export async function generateAutoPost(req: AutoPostRequest): Promise<AutoPostResult> {
  const { trend, provider, language, templateId } = req;

  const template = templateId ? getTemplateById(templateId) : getTemplateByName(PRESS_POSTER_TEMPLATE_NAME);
  if (!template) {
    throw new AutoPostInputError("Auto-post template not found — try again in a moment (it seeds on server startup).");
  }

  // Settled (not raced) so that if both the AI call and photo resolution fail, the reported
  // error says so instead of silently only surfacing whichever happened to reject first.
  const [captionSettled, photoSettled] = await Promise.allSettled([
    generateCaptions({ provider, trend, language, tones: ["informative"] }),
    resolvePhoto(trend),
  ]);

  if (captionSettled.status === "rejected" && photoSettled.status === "rejected") {
    throw new Error(`AI generation failed (${captionSettled.reason?.message}); photo resolution also failed (${photoSettled.reason?.message})`);
  }
  if (captionSettled.status === "rejected") throw captionSettled.reason;
  if (photoSettled.status === "rejected") throw photoSettled.reason;

  const captionResult = captionSettled.value;
  const { buffer: photoBuffer, source: photoSource } = photoSettled.value;

  const primaryVariant = captionResult.variants[0];
  const headline =
    captionResult.headline?.trim() ||
    primaryVariant?.caption.split(/(?<=[.!?])\s+/)[0] ||
    trend.title;

  const image = await renderPost({
    template,
    values: { headline },
    photos: { photo: photoBuffer },
    // outputWidth/outputHeight intentionally omitted -- renderPost() defaults to a
    // 4K-scale export (see computeDefaultOutputSize) rather than the design canvas size.
    format: "jpeg",
    watermark: getWatermarkOption(),
  });

  return {
    headline,
    caption: primaryVariant?.caption ?? "",
    hashtags: primaryVariant?.hashtags ?? [],
    suggestedPostTime: captionResult.suggestedPostTime,
    image,
    photoSource,
  };
}
