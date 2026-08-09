import { Router } from "express";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db } from "../db/index.js";
import { uploadTemplateImage } from "../middleware/upload.js";
import type { Template } from "../types.js";

export const templatesRouter = Router();

function rowToTemplate(row: any): Template {
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

templatesRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
  res.json({ templates: rows.map(rowToTemplate) });
});

templatesRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Template not found" });
  res.json({ template: rowToTemplate(row) });
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
  maxLines: z.number().int().positive().optional(),
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
templatesRouter.post("/", uploadTemplateImage.single("file"), async (req, res) => {
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

  const metadata = await sharp(req.file.path).metadata();
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

  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
  res.status(201).json({ template: rowToTemplate(row) });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  zones: z.array(zoneSchema).min(1).optional(),
  style: styleSchema.optional(),
});

templatesRouter.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const merged = { ...rowToTemplate(existing), ...parsed.data, updatedAt: new Date().toISOString() };

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

  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  res.json({ template: rowToTemplate(row) });
});

templatesRouter.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  res.status(204).send();
});
