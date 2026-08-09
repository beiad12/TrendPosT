import sharp from "sharp";
import type { Template } from "../../types.js";
import { buildTextLayerSvg } from "./svg.js";
import { buildHighlightMarkup, renderRichText } from "./richText.js";

type Overlay = { input: string | Buffer; left: number; top: number };

export interface RenderOptions {
  template: Template;
  /** Absolute path to the source photo, or a Buffer if already fetched. */
  photo: string | Buffer;
  headline: string;
  /** Rich-content templates only (e.g. "Maroc Viral"): category pill + description paragraph. */
  category?: string;
  description?: string;
  /** Output size for the Facebook feed (e.g. 1080x1080). Defaults to the template canvas size. */
  outputWidth?: number;
  outputHeight?: number;
  format?: "png" | "jpeg";
}

function parseColor(hex: string): { r: number; g: number; b: number; alpha: number } {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
    alpha: 1,
  };
}

/**
 * Renders the category pill + headline (with `**highlight**` support) +
 * description as separate Pango-rendered text blocks, positioned in their
 * own zones — the "Maroc Viral" rich-content layout. Used whenever a
 * template defines `categoryZone` and/or `descriptionZone`.
 */
async function buildRichContentLayer(opts: {
  canvasWidth: number;
  canvasHeight: number;
  template: Template;
  headline: string;
  category?: string;
  description?: string;
}): Promise<Overlay[]> {
  const { template, headline, category, description } = opts;
  const { textZone, categoryZone, descriptionZone, style } = template;

  const baseColor = style.fontColor ?? "#FFFFFF";
  const highlightColor = style.highlightColor ?? "#39FF14";
  const categoryColor = style.categoryColor ?? "#FFFFFF";
  const descriptionColor = style.descriptionColor ?? "#D9E2EA";

  const composites: Overlay[] = [];

  if (category && categoryZone) {
    const dotColor = highlightColor;
    const markup = `<span foreground="${dotColor}">●</span> <span foreground="${categoryColor}">${category
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</span>`;
    const rendered = await renderRichText({
      text: markup,
      isMarkup: true,
      weight: "bold",
      box: { width: categoryZone.width, height: categoryZone.height },
      align: categoryZone.align ?? "left",
    });
    composites.push({ input: rendered.buffer, left: Math.round(categoryZone.x), top: Math.round(categoryZone.y) });
  }

  if (headline && textZone) {
    const markup = buildHighlightMarkup(headline, baseColor, highlightColor);
    const rendered = await renderRichText({
      text: markup,
      isMarkup: true,
      weight: "extrabold",
      box: { width: textZone.width, height: textZone.height },
      align: textZone.align ?? "left",
    });
    composites.push({ input: rendered.buffer, left: Math.round(textZone.x), top: Math.round(textZone.y) });
  }

  if (description && descriptionZone) {
    const rendered = await renderRichText({
      text: description,
      weight: "regular",
      color: descriptionColor,
      box: { width: descriptionZone.width, height: descriptionZone.height },
      align: descriptionZone.align ?? "left",
    });
    composites.push({ input: rendered.buffer, left: Math.round(descriptionZone.x), top: Math.round(descriptionZone.y) });
  }

  return composites;
}

/**
 * Renders the final branded post image. Two content modes:
 *
 * - Rich-content templates (categoryZone and/or descriptionZone defined,
 *   e.g. "Maroc Viral"): category pill + headline (with `**word**` ->
 *   brand-highlight-color support) + description are each rendered with
 *   real brand fonts (Cairo/Montserrat via Pango) into their own zones,
 *   sitting directly on the template's own background — no gradient
 *   needed since text isn't over the photo.
 * - Legacy templates (just imageSlot + textZone, e.g. user-uploaded
 *   frames): original gradient-banner + single auto-fit headline behavior,
 *   unchanged, for backward compatibility.
 *
 * In both modes: photo is cover-fit into the image slot, and the
 * template's frame is composited LAST so its border/branding stays crisp
 * on top of the photo and text.
 */
export async function renderPost(opts: RenderOptions): Promise<Buffer> {
  const { template, photo, headline, category, description } = opts;
  const { canvasWidth, canvasHeight, imageSlot, style, baseImagePath, categoryZone, descriptionZone } = template;

  const isRichContent = Boolean(categoryZone || descriptionZone);

  // 1. Photo, cover-fit + cropped to the exact slot dimensions.
  const photoBuffer = await sharp(photo)
    .resize(imageSlot.width, imageSlot.height, { fit: "cover", position: "attention" })
    .toBuffer();

  const composites: Overlay[] = [
    { input: photoBuffer, left: Math.round(imageSlot.x), top: Math.round(imageSlot.y) },
  ];

  if (isRichContent) {
    composites.push(
      ...(await buildRichContentLayer({ canvasWidth, canvasHeight, template, headline, category, description }))
    );
  } else {
    const textLayerSvg = buildTextLayerSvg({
      canvasWidth,
      canvasHeight,
      zone: template.textZone,
      headline,
      style,
    });
    composites.push({ input: textLayerSvg, left: 0, top: 0 });
  }

  composites.push({ input: baseImagePath, left: 0, top: 0 }); // frame stays on top, final flatten

  const background = style.canvasBackground ? parseColor(style.canvasBackground) : { r: 0, g: 0, b: 0, alpha: 0 };

  const composed = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toBuffer();

  // 3. Resize to requested export size + flatten to the requested format.
  const outW = opts.outputWidth ?? canvasWidth;
  const outH = opts.outputHeight ?? canvasHeight;
  const format = opts.format ?? "jpeg";

  let pipeline = sharp(composed).resize(outW, outH, { fit: "cover" });
  pipeline = format === "png" ? pipeline.png() : pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 92 });

  return pipeline.toBuffer();
}
