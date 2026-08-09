import { Router } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { db } from "../db/index.js";
import { uploadPhoto, EXPORTS_DIR } from "../middleware/upload.js";
import { renderPost } from "../services/render/renderEngine.js";
import type { Template } from "../types.js";

export const renderRouter = Router();

function loadTemplate(id: string): Template | null {
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    baseImagePath: row.base_image_path,
    canvasWidth: row.canvas_width,
    canvasHeight: row.canvas_height,
    imageSlot: JSON.parse(row.image_slot_json),
    textZone: JSON.parse(row.text_zone_json),
    categoryZone: row.category_zone_json ? JSON.parse(row.category_zone_json) : undefined,
    descriptionZone: row.description_zone_json ? JSON.parse(row.description_zone_json) : undefined,
    style: JSON.parse(row.style_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const bodySchema = z.object({
  templateId: z.string().uuid(),
  headline: z.string().min(1),
  /** Optional: category pill + description paragraph, used by rich-content templates (e.g. "Maroc Viral"). */
  category: z.string().optional(),
  description: z.string().optional(),
  photoUrl: z.string().url().optional(),
  outputWidth: z.coerce.number().optional(),
  outputHeight: z.coerce.number().optional(),
  format: z.enum(["png", "jpeg"]).optional(),
});

/**
 * POST /api/render
 * multipart/form-data OR JSON body:
 *   templateId, headline, and EITHER photo=<file upload> OR photoUrl=<remote image>
 * Returns the rendered image (binary) and persists a copy under /exports.
 */
renderRouter.post("/", uploadPhoto.single("photo"), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { templateId, headline, category, description, photoUrl, outputWidth, outputHeight, format } = parsed.data;

  const template = loadTemplate(templateId);
  if (!template) return res.status(404).json({ error: "Template not found" });

  let photoInput: string | Buffer;
  if (req.file) {
    photoInput = req.file.path;
  } else if (photoUrl) {
    const resp = await fetch(photoUrl);
    if (!resp.ok) return res.status(400).json({ error: `Could not fetch photoUrl (${resp.status})` });
    photoInput = Buffer.from(await resp.arrayBuffer());
  } else {
    return res.status(400).json({ error: "Provide a photo upload or photoUrl" });
  }

  try {
    const output = await renderPost({
      template,
      photo: photoInput,
      headline,
      category,
      description,
      outputWidth,
      outputHeight,
      format,
    });

    const ext = format === "png" ? "png" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const outPath = path.join(EXPORTS_DIR, filename);
    fs.writeFileSync(outPath, output);

    res.setHeader("Content-Type", format === "png" ? "image/png" : "image/jpeg");
    res.setHeader("X-Export-Path", outPath);
    res.send(output);
  } catch (err: any) {
    res.status(500).json({ error: "Render failed", detail: err?.message });
  }
});
