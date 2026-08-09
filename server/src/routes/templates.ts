import { Router } from "express";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db } from "../db/index.js";
import { uploadTemplateImage, uploadMemory } from "../middleware/upload.js";
import { detectTemplateZones, detectedZonesToDefs } from "../services/ai/zoneDetection.js";
import { ProviderKeyMissingError } from "../services/ai/types.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { rowToTemplate, getTemplateById } from "../services/templateStore.js";

export const templatesRouter = Router();

/**
 * POST /api/templates/detect-zones
 * multipart/form-data: file=<template image>
 * Uses Claude's vision to propose a starting set of zones (photo + text
 * placeholders) for an uploaded template image — a smart first draft the
 * user reviews/adjusts in the editor rather than dragging every rectangle
 * by hand. Requires an Anthropic API key configured in Settings.
 */
templatesRouter.post("/detect-zones", uploadMemory.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  try {
    const detected = await detectTemplateZones(req.file.buffer);
    if (detected.length === 0) {
      return res.status(422).json({
        error: "no_zones_detected",
        message: "Couldn't identify any placeholder areas in this image — try adding zones manually.",
      });
    }
    res.json({ zones: detectedZonesToDefs(detected) });
  } catch (err) {
    if (err instanceof ProviderKeyMissingError) {
      return res.status(400).json({ error: "missing_api_key", provider: "anthropic" });
    }
    res.status(500).json({ error: "Zone detection failed", detail: (err as Error)?.message });
  }
}));

templatesRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
  res.json({ templates: rows.map(rowToTemplate) });
});

templatesRouter.get("/:id", (req, res) => {
  const template = getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json({ template });
});

const zoneBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  locked: z.boolean().optional(),
});

const textZoneSchema = zoneBaseSchema.extend({
  type: z.literal("text"),
  align: z.enum(["left", "center", "right"]).optional(),
  weight: z.enum(["regular", "bold", "extrabold"]).optional(),
  color: z.string().optional(),
  highlightColor: z.string().optional(),
  defaultValue: z.string().optional(),
  pill: z.boolean().optional(),
  pillColor: z.string().optional(),
});

const photoZoneSchema = zoneBaseSchema.extend({
  type: z.literal("photo"),
});

const zoneSchema = z.discriminatedUnion("type", [textZoneSchema, photoZoneSchema]);

const styleSchema = z.object({
  canvasBackground: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("news"),
  zones: z.array(zoneSchema).min(1),
  style: styleSchema.default({}),
});

/**
 * POST /api/templates
 * multipart/form-data: file=<background artwork>, name, category,
 * zones=<JSON array of ZoneDef>, style=<JSON, optional>.
 *
 * The uploaded artwork is stored and used pixel-perfect as the locked
 * bottom layer — it does not need any real alpha transparency; every zone
 * (photo or text) is composited strictly on top of it at render time.
 */
templatesRouter.post("/", uploadTemplateImage.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  let parsed;
  try {
    parsed = createSchema.parse({
      name: req.body.name,
      category: req.body.category,
      zones: JSON.parse(req.body.zones),
      style: req.body.style ? JSON.parse(req.body.style) : {},
    });
  } catch (err: any) {
    return res.status(400).json({ error: "Invalid template payload", detail: err?.message });
  }

  const ids = parsed.zones.map((z) => z.id);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: "Zone ids must be unique" });
  }

  let metadata;
  try {
    metadata = await sharp(req.file.path).metadata();
  } catch (err: any) {
    return res.status(400).json({ error: "Uploaded file is not a valid image", detail: err?.message });
  }
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO templates
      (id, name, category, base_image_path, canvas_width, canvas_height, zones_json, style_json, created_at, updated_at)
     VALUES (@id, @name, @category, @base_image_path, @canvas_width, @canvas_height, @zones_json, @style_json, @created_at, @updated_at)`
  ).run({
    id,
    name: parsed.name,
    category: parsed.category,
    base_image_path: req.file.path,
    canvas_width: metadata.width ?? 1080,
    canvas_height: metadata.height ?? 1080,
    zones_json: JSON.stringify(parsed.zones),
    style_json: JSON.stringify(parsed.style),
    created_at: now,
    updated_at: now,
  });

  const created = getTemplateById(id);
  res.status(201).json({ template: created });
}));

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  zones: z.array(zoneSchema).min(1).optional(),
  style: styleSchema.optional(),
});

templatesRouter.patch("/:id", (req, res) => {
  const existing = getTemplateById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const merged = { ...existing, ...parsed.data, updatedAt: new Date().toISOString() };

  db.prepare(
    `UPDATE templates SET
      name = @name, category = @category,
      zones_json = @zones_json, style_json = @style_json,
      updated_at = @updated_at
     WHERE id = @id`
  ).run({
    id: req.params.id,
    name: merged.name,
    category: merged.category,
    zones_json: JSON.stringify(merged.zones),
    style_json: JSON.stringify(merged.style),
    updated_at: merged.updatedAt,
  });

  res.json({ template: getTemplateById(req.params.id) });
});

templatesRouter.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT id FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Template not found" });
  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  res.json({ deleted: true, id: req.params.id });
});
