import { Router } from "express";
import { z } from "zod";
import { uploadLogo } from "../middleware/upload.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getBranding, setBrandingLogo, setBrandingPosition, clearBrandingLogo } from "../services/brandingStore.js";

export const brandingRouter = Router();

function toPublicPath(logoPath: string | null): string | null {
  if (!logoPath) return null;
  return `/static/branding/${logoPath.split(/[\\/]/).pop()}`;
}

brandingRouter.get("/logo", (_req, res) => {
  const branding = getBranding();
  res.json({ logoUrl: toPublicPath(branding.logoPath), position: branding.position, updatedAt: branding.updatedAt });
});

const positionSchema = z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]);

/**
 * POST /api/branding/logo
 * multipart/form-data: file=<logo image>, position=<optional corner>
 * Stores the page's logo, stamped automatically onto every future render
 * (auto-post and manual template renders alike) — no per-request opt-in.
 */
brandingRouter.post("/logo", uploadLogo.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const parsedPosition = positionSchema.safeParse(req.body.position);
  const position = parsedPosition.success ? parsedPosition.data : "bottom-right";

  const branding = setBrandingLogo(req.file.path, position);
  res.status(201).json({ logoUrl: toPublicPath(branding.logoPath), position: branding.position, updatedAt: branding.updatedAt });
}));

const patchSchema = z.object({ position: positionSchema });

brandingRouter.patch("/logo", (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const branding = setBrandingPosition(parsed.data.position);
  res.json({ logoUrl: toPublicPath(branding.logoPath), position: branding.position, updatedAt: branding.updatedAt });
});

brandingRouter.delete("/logo", (_req, res) => {
  const branding = clearBrandingLogo();
  res.json({ logoUrl: toPublicPath(branding.logoPath), position: branding.position, updatedAt: branding.updatedAt });
});
