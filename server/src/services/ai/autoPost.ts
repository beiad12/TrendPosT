import { generateCaptions } from "./router.js";
import { renderPost } from "../render/renderEngine.js";
import { getTemplateById, getTemplateByName } from "../templateStore.js";
import { PRESS_POSTER_TEMPLATE_NAME } from "../seedTemplates.js";
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

export interface AutoPostResult {
  headline: string;
  caption: string;
  hashtags: string[];
  suggestedPostTime?: string;
  image: Buffer;
}

/**
 * The end-to-end AI pipeline: fetches the trend's own photo, has the AI
 * write a punchy headline for it, and renders the two together — no
 * manual photo upload or manual text entry required. This is the "nothing
 * without AI" flow: everything but the template's fixed layout comes from
 * the trend + the AI.
 */
export async function generateAutoPost(req: AutoPostRequest): Promise<AutoPostResult> {
  const { trend, provider, language, templateId } = req;

  if (!trend.imageUrl) {
    throw new AutoPostInputError(
      "This trend has no photo to work with — pick a trend that has one, or use the manual Templates flow with your own photo."
    );
  }

  const template = templateId ? getTemplateById(templateId) : getTemplateByName(PRESS_POSTER_TEMPLATE_NAME);
  if (!template) {
    throw new AutoPostInputError("Auto-post template not found — try again in a moment (it seeds on server startup).");
  }

  // Settled (not raced) so that if both the AI call and the photo fetch fail, the reported
  // error says so instead of silently only surfacing whichever happened to reject first.
  const [captionSettled, photoSettled] = await Promise.allSettled([
    generateCaptions({ provider, trend, language, tones: ["informative"] }),
    fetch(trend.imageUrl).then(async (resp) => {
      if (!resp.ok) throw new AutoPostInputError(`Could not fetch this trend's photo (${resp.status})`);
      return Buffer.from(await resp.arrayBuffer());
    }),
  ]);

  if (captionSettled.status === "rejected" && photoSettled.status === "rejected") {
    throw new Error(`AI generation failed (${captionSettled.reason?.message}); photo fetch also failed (${photoSettled.reason?.message})`);
  }
  if (captionSettled.status === "rejected") throw captionSettled.reason;
  if (photoSettled.status === "rejected") throw photoSettled.reason;

  const captionResult = captionSettled.value;
  const photoBuffer = photoSettled.value;

  const primaryVariant = captionResult.variants[0];
  const headline =
    captionResult.headline?.trim() ||
    primaryVariant?.caption.split(/(?<=[.!?])\s+/)[0] ||
    trend.title;

  const image = await renderPost({
    template,
    values: { headline },
    photos: { photo: photoBuffer },
    outputWidth: template.canvasWidth,
    outputHeight: template.canvasHeight,
    format: "jpeg",
  });

  return {
    headline,
    caption: primaryVariant?.caption ?? "",
    hashtags: primaryVariant?.hashtags ?? [],
    suggestedPostTime: captionResult.suggestedPostTime,
    image,
  };
}
