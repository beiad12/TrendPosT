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
    imageSlot: JSON.parse(row.image_slot_json),
    textZone: JSON.parse(row.text_zone_json),
    categoryZone: row.category_zone_json ? JSON.parse(row.category_zone_json) : undefined,
    descriptionZone: row.description_zone_json ? JSON.parse(row.description_zone_json) : undefined,
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

const rectSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
const textZoneSchema = rectSchema.extend({ align: z.enum(["left", "center", "right"]).optional() });
const styleSchema = z.object({
  fontFamily: z.string().optional(),
  fontColor: z.string().optional(),
  fontWeight: z.number().optional(),
  gradientDirection: z.enum(["to-top", "to-bottom", "to-left", "to-right"]).optional(),
  gradientOpacity: z.number().min(0).max(1).optional(),
  canvasBackground: z.string().optional(),
  highlightColor: z.string().optional(),
  categoryColor: z.string().optional(),
  descriptionColor: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("news"),
  imageSlot: rectSchema,
  textZone: textZoneSchema,
  style: styleSchema.default({}),
});

/**
 * POST /api/templates
 * multipart/form-data: file=<template frame image>, plus JSON fields above
 * (imageSlot/textZone/style sent as JSON strings).
 */
templatesRouter.post("/", uploadTemplateImage.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  let parsed;
  try {
    parsed = createSchema.parse({
      name: req.body.name,
      category: req.body.category,
      imageSlot: JSON.parse(req.body.imageSlot),
      textZone: JSON.parse(req.body.textZone),
      style: req.body.style ? JSON.parse(req.body.style) : {},
    });
  } catch (err: any) {
    return res.status(400).json({ error: "Invalid template payload", detail: err?.message });
  }

  const metadata = await sharp(req.file.path).metadata();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO templates
      (id, name, category, base_image_path, canvas_width, canvas_height, image_slot_json, text_zone_json, style_json, created_at, updated_at)
     VALUES (@id, @name, @category, @base_image_path, @canvas_width, @canvas_height, @image_slot_json, @text_zone_json, @style_json, @created_at, @updated_at)`
  ).run({
    id,
    name: parsed.name,
    category: parsed.category,
    base_image_path: req.file.path,
    canvas_width: metadata.width ?? 1080,
    canvas_height: metadata.height ?? 1080,
    image_slot_json: JSON.stringify(parsed.imageSlot),
    text_zone_json: JSON.stringify(parsed.textZone),
    style_json: JSON.stringify(parsed.style),
    created_at: now,
    updated_at: now,
  });

  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
  res.status(201).json({ template: rowToTemplate(row) });
});

const updateSchema = createSchema.partial();

templatesRouter.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const merged = { ...rowToTemplate(existing), ...parsed.data, updatedAt: new Date().toISOString() };

  db.prepare(
    `UPDATE templates SET
      name = @name, category = @category,
      image_slot_json = @image_slot_json, text_zone_json = @text_zone_json, style_json = @style_json,
      updated_at = @updated_at
     WHERE id = @id`
  ).run({
    id: req.params.id,
    name: merged.name,
    category: merged.category,
    image_slot_json: JSON.stringify(merged.imageSlot),
    text_zone_json: JSON.stringify(merged.textZone),
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
