import { db } from "../db/index.js";
import type { Template } from "../types.js";

export function rowToTemplate(row: any): Template {
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

export function getTemplateById(id: string): Template | null {
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
  return row ? rowToTemplate(row) : null;
}

export function getTemplateByName(name: string): Template | null {
  const row = db.prepare("SELECT * FROM templates WHERE name = ?").get(name);
  return row ? rowToTemplate(row) : null;
}
