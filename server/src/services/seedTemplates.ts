import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { db } from "../db/index.js";
import { TEMPLATES_DIR } from "../middleware/upload.js";
import { buildMarocViralFrame, marocViralGeometry } from "./render/buildMarocViralFrame.js";
import { buildPressPosterBackground, pressPosterGeometry } from "./render/buildPressPosterFrame.js";
import { MAROC_VIRAL_COLORS as C } from "./render/brand.js";

interface Variant {
  language: "ar" | "fr";
  name: string;
}

const VARIANTS: Variant[] = [
  { language: "ar", name: "Maroc Viral — أخبار (عربي)" },
  { language: "fr", name: "Maroc Viral — News (Français)" },
];

/** Looked up by the auto-post pipeline to pick its default template. */
export const PRESS_POSTER_TEMPLATE_NAME = "AI Auto Post — Photo + Headline";

function insertTemplate(row: {
  id: string;
  name: string;
  category: string;
  base_image_path: string;
  canvas_width: number;
  canvas_height: number;
  zones_json: string;
  style_json: string;
}) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO templates
      (id, name, category, base_image_path, canvas_width, canvas_height, zones_json, style_json, created_at, updated_at)
     VALUES
      (@id, @name, @category, @base_image_path, @canvas_width, @canvas_height, @zones_json, @style_json, @created_at, @updated_at)`
  ).run({ ...row, created_at: now, updated_at: now });
}

/**
 * Idempotently seeds the branded "Maroc Viral" templates (Arabic + French
 * variants) so the app is usable out of the box — generates the frame PNG
 * (see buildMarocViralFrame.ts) and inserts the matching DB row using the
 * generic layer/zone system, but only if a template with that name doesn't
 * already exist.
 */
export async function seedMarocViralTemplates(): Promise<void> {
  for (const variant of VARIANTS) {
    const existing = db.prepare("SELECT id FROM templates WHERE name = ?").get(variant.name);
    if (existing) continue;

    const frameBuffer = await buildMarocViralFrame(variant.language);
    const filename = `maroc-viral-${variant.language}-${randomUUID()}.png`;
    const filePath = path.join(TEMPLATES_DIR, filename);
    fs.writeFileSync(filePath, frameBuffer);

    const geo = marocViralGeometry(1080, variant.language);

    insertTemplate({
      id: randomUUID(),
      name: variant.name,
      category: "news",
      base_image_path: filePath,
      canvas_width: geo.canvas,
      canvas_height: geo.canvas,
      zones_json: JSON.stringify(geo.zones),
      style_json: JSON.stringify({ canvasBackground: C.bgPrimary }),
    });

    console.log(`Seeded template: ${variant.name}`);
  }
}

/**
 * Idempotently seeds the minimal "AI Auto Post" template (full-bleed photo
 * + gradient + headline, no branding) — the default target for the
 * one-click AI pipeline (POST /api/auto-post).
 */
export async function seedPressPosterTemplate(): Promise<void> {
  const existing = db.prepare("SELECT id FROM templates WHERE name = ?").get(PRESS_POSTER_TEMPLATE_NAME);
  if (existing) return;

  const canvas = 1080;
  const bgBuffer = await buildPressPosterBackground(canvas);
  const filename = `press-poster-${randomUUID()}.png`;
  const filePath = path.join(TEMPLATES_DIR, filename);
  fs.writeFileSync(filePath, bgBuffer);

  const geo = pressPosterGeometry(canvas);

  insertTemplate({
    id: randomUUID(),
    name: PRESS_POSTER_TEMPLATE_NAME,
    category: "news",
    base_image_path: filePath,
    canvas_width: geo.canvas,
    canvas_height: geo.canvas,
    zones_json: JSON.stringify(geo.zones),
    style_json: JSON.stringify({}),
  });

  console.log(`Seeded template: ${PRESS_POSTER_TEMPLATE_NAME}`);
}
