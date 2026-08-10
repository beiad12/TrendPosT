import { Router } from "express";
import { z } from "zod";
import { generateAutoPost, AutoPostInputError } from "../services/ai/autoPost.js";
import { ProviderKeyMissingError } from "../services/ai/types.js";
import { PROVIDERS } from "../services/ai/providers.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const autoPostRouter = Router();

const bodySchema = z.object({
  trend: z.object({
    title: z.string().min(1),
    summary: z.string().optional(),
    sourceUrl: z.string().url(),
    source: z.string().min(1),
    category: z.string().optional(),
    // Optional now: a missing/unreachable photo falls through to a web image
    // search and then AI generation (see autoPost.ts#resolvePhoto) instead of
    // failing outright.
    imageUrl: z.string().url().optional().nullable(),
    score: z.number().optional(),
    sourceCount: z.number().optional(),
    publishedAt: z.string().optional(),
  }),
  provider: z.enum(PROVIDERS),
  language: z.enum(["darija", "french", "msa", "english"]),
  templateId: z.string().uuid().optional(),
});

/**
 * POST /api/auto-post
 * Body: { trend: {..., imageUrl?}, provider, language, templateId? }
 *
 * The one-click AI pipeline: resolves a photo for the trend (its own
 * source photo if it has a reachable one; otherwise a web image search;
 * otherwise AI-generated as a last resort — see autoPost.ts#resolvePhoto),
 * has the AI write a headline for it, and renders them together onto the
 * "photo + headline" template — nothing manual. Returns the caption
 * text/hashtags, which fallback the photo actually came from
 * (`photoSource`), and the rendered image (as base64) in one round trip.
 */
autoPostRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await generateAutoPost(parsed.data);
    res.json({
      headline: result.headline,
      caption: result.caption,
      hashtags: result.hashtags,
      suggestedPostTime: result.suggestedPostTime,
      imageBase64: result.image.toString("base64"),
      format: "jpeg",
      photoSource: result.photoSource,
    });
  } catch (err: any) {
    if (err instanceof ProviderKeyMissingError) {
      return res.status(400).json({ error: "missing_api_key", provider: err.provider });
    }
    if (err instanceof AutoPostInputError) {
      return res.status(400).json({ error: "auto_post_failed", message: err.message });
    }
    res.status(502).json({ error: "auto_post_failed", message: err?.message ?? "Auto-post generation failed" });
  }
}));
