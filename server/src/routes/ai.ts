import { Router } from "express";
import { z } from "zod";
import { generateCaptions } from "../services/ai/router.js";
import { ProviderKeyMissingError } from "../services/ai/types.js";
import { PROVIDERS } from "../services/ai/providers.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const aiRouter = Router();

const generateSchema = z.object({
  provider: z.enum(PROVIDERS).optional(), // omitted => "Compare All"
  language: z.enum(["darija", "french", "msa"]),
  tones: z
    .array(
      z.enum(["funny", "informative", "question-hook", "emotional", "controversial-safe"])
    )
    .optional(),
  trend: z.object({
    title: z.string().min(1),
    summary: z.string().optional(),
    sourceUrl: z.string().url(),
    source: z.string().min(1),
    category: z.string().optional(),
  }),
});

/**
 * POST /api/ai/generate
 * Body: { provider?, trend, language, tones? }
 * If `provider` is omitted, runs "Compare All" across every configured provider.
 */
aiRouter.post("/generate", asyncHandler(async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { provider, trend, language, tones } = parsed.data;

  const targets = provider ? [provider] : PROVIDERS;

  const results = await Promise.allSettled(
    targets.map((p) => generateCaptions({ provider: p, trend, language, tones }))
  );

  const payload = results.map((r, i) => {
    const p = targets[i];
    if (r.status === "fulfilled") {
      return { provider: p, ok: true, result: r.value };
    }
    const err = r.reason;
    if (err instanceof ProviderKeyMissingError) {
      return { provider: p, ok: false, error: "missing_api_key" };
    }
    return { provider: p, ok: false, error: err?.message ?? "generation_failed" };
  });

  res.json({ results: payload });
}));
