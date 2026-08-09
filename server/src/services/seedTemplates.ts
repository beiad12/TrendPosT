import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { db } from "../db/index.js";
import { TEMPLATES_DIR } from "../middleware/upload.js";
import { buildMarocViralFrame, marocViralGeometry } from "./render/buildMarocViralFrame.js";
import { MAROC_VIRAL_COLORS as C } from "./render/brand.js";

interface Variant {
  language: "ar" | "fr";
  name: string;
}

const VARIANTS: Variant[] = [
  { language: "ar", name: "Maroc Viral — أخبار (عربي)" },
  { language: "fr", name: "Maroc Viral — News (Français)" },
];

/**
 * Idempotently seeds the branded "Maroc Viral" templates (Arabic + French
 * variants) so the app is usable out of the box — generates the frame PNG
 * (see buildMarocViralFrame.ts) and inserts the matching DB row, but only
 * if a template with that name doesn't already exist.
 */
export async function seedMarocViralTemplates(): Promise<void> {
  for (const variant of VARIANTS) {
    const existing = db.prepare("SELECT id FROM templates WHERE name = ?").get(variant.name);
    if (existing) continue;

    const frameBuffer = await buildMarocViralFrame(variant.language);
    const filename = `maroc-viral-${variant.language}-${randomUUID()}.png`;
    const filePath = path.join(TEMPLATES_DIR, filename);
    fs.writeFileSync(filePath, frameBuffer);

    const geo = marocViralGeometry();
    const align = variant.language === "ar" ? "right" : "left";
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO templates
        (id, name, category, base_image_path, canvas_width, canvas_height,
         image_slot_json, text_zone_json, category_zone_json, description_zone_json,
         style_json, created_at, updated_at)
       VALUES
        (@id, @name, @category, @base_image_path, @canvas_width, @canvas_height,
         @image_slot_json, @text_zone_json, @category_zone_json, @description_zone_json,
         @style_json, @created_at, @updated_at)`
    ).run({
      id,
      name: variant.name,
      category: "news",
      base_image_path: filePath,
      canvas_width: geo.canvas,
      canvas_height: geo.canvas,
      image_slot_json: JSON.stringify(geo.imageSlot),
      text_zone_json: JSON.stringify({ ...geo.headlineZone, align }),
      category_zone_json: JSON.stringify({ ...geo.categoryZone, align }),
      description_zone_json: JSON.stringify({ ...geo.descriptionZone, align }),
      style_json: JSON.stringify({
        fontColor: C.textPrimary,
        highlightColor: C.green,
        categoryColor: C.textPrimary,
        descriptionColor: C.textSecondary,
        canvasBackground: C.bgPrimary,
      }),
      created_at: now,
      updated_at: now,
    });

    console.log(`Seeded template: ${variant.name}`);
  }
}
