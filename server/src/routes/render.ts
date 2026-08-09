import { Router } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { db } from "../db/index.js";
import { uploadAnyPhotos, EXPORTS_DIR } from "../middleware/upload.js";
import { renderPost } from "../services/render/renderEngine.js";
import { isPhotoZone } from "../types.js";
import type { Template } from "../types.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

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
    zones: JSON.parse(row.zones_json),
    style: JSON.parse(row.style_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const bodySchema = z.object({
  templateId: z.string().uuid(),
  /** zoneId -> text content, JSON-encoded. */
  values: z.string().optional(),
  /** zoneId -> remote photo URL, JSON-encoded, for zones not covered by a file upload. */
  photoUrls: z.string().optional(),
  outputWidth: z.coerce.number().optional(),
  outputHeight: z.coerce.number().optional(),
  format: z.enum(["png", "jpeg"]).optional(),
});

/**
 * POST /api/render
 * multipart/form-data:
 *   templateId, values=<JSON {zoneId: text}>, photoUrls=<JSON {zoneId: url}>,
 *   plus any number of file fields named after a photo zone's id (e.g. "photo").
 * Returns the rendered image (binary) and persists a copy under /exports.
 */
renderRouter.post("/", uploadAnyPhotos, asyncHandler(async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { templateId, outputWidth, outputHeight, format } = parsed.data;

  const template = loadTemplate(templateId);
  if (!template) return res.status(404).json({ error: "Template not found" });

  let values: Record<string, string> = {};
  let photoUrls: Record<string, string> = {};
  try {
    if (parsed.data.values) values = JSON.parse(parsed.data.values);
    if (parsed.data.photoUrls) photoUrls = JSON.parse(parsed.data.photoUrls);
  } catch {
    return res.status(400).json({ error: "values/photoUrls must be valid JSON" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const filesByZone = new Map(files.map((f) => [f.fieldname, f]));

  const photoZoneIds = template.zones.filter(isPhotoZone).map((z) => z.id);
  const photos: Record<string, string | Buffer> = {};

  const remoteFetches = photoZoneIds
    .filter((zoneId) => !filesByZone.has(zoneId) && photoUrls[zoneId])
    .map(async (zoneId) => {
      const url = photoUrls[zoneId];
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Could not fetch photo for "${zoneId}" (${resp.status})`);
      return { zoneId, buffer: Buffer.from(await resp.arrayBuffer()) };
    });

  for (const zoneId of photoZoneIds) {
    const file = filesByZone.get(zoneId);
    if (file) photos[zoneId] = file.path;
  }

  try {
    const fetched = await Promise.all(remoteFetches);
    for (const { zoneId, buffer } of fetched) photos[zoneId] = buffer;
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Could not fetch a remote photo" });
  }

  try {
    const output = await renderPost({
      template,
      values,
      photos,
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
}));
