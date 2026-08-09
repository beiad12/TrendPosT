import sharp from "sharp";
import type { Template } from "../../types.js";
import { isPhotoZone, isTextZone } from "../../types.js";
import { buildHighlightMarkup, escapePango, renderRichText } from "./richText.js";
import { buildPillSvg } from "./pill.js";
import { buildGradientOverlaySvg } from "./gradient.js";
import { isArabicText } from "./fonts.js";

type Overlay = { input: string | Buffer; left: number; top: number };

export interface RenderOptions {
  template: Template;
  /** zoneId -> text content, for text zones. Locked zones ignore this and always use their defaultValue. */
  values?: Record<string, string>;
  /** zoneId -> photo (absolute path or already-fetched Buffer), for photo zones. */
  photos?: Record<string, string | Buffer>;
  /** Output size for the Facebook feed (e.g. 1080x1080). Defaults to the template canvas size. */
  outputWidth?: number;
  outputHeight?: number;
  format?: "png" | "jpeg";
  /** Page logo, stamped on top of every zone, in every render, regardless of template. */
  watermark?: { logoPath: string; position: "bottom-right" | "bottom-left" | "top-right" | "top-left" };
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
 * Renders the final branded post image using the template's reusable layer
 * system:
 *
 *   1. The uploaded background artwork is composited pixel-perfect as the
 *      bottom layer — it never needs a real alpha-transparent hole to work,
 *      a fully flattened, opaque PNG/JPG export from any design tool is
 *      fine, since every zone below draws strictly ON TOP of it.
 *   2. Each zone (in the template's defined paint order) is composited on
 *      top: photo zones are cover-fit + cropped to their box; text zones
 *      are rendered with real brand fonts (Cairo for Arabic, Montserrat
 *      for Latin, auto-picked per zone's actual content) via Pango, with
 *      native auto-fit/auto-wrap and `**word**` -> per-zone highlight-color
 *      support. Locked zones always render their fixed `defaultValue` and
 *      ignore any request-supplied value.
 *   3. Flattened + resized to the requested Facebook export size.
 */
export async function renderPost(opts: RenderOptions): Promise<Buffer> {
  const { template, values = {}, photos = {} } = opts;
  const { canvasWidth, canvasHeight, zones, style, baseImagePath } = template;

  const composites: Overlay[] = [{ input: baseImagePath, left: 0, top: 0 }];

  for (const zone of zones) {
    if (isPhotoZone(zone)) {
      const photoInput = photos[zone.id];
      if (!photoInput) continue; // no photo supplied for this zone -> background artwork shows through
      const photoBuffer = await sharp(photoInput)
        .resize(Math.round(zone.width), Math.round(zone.height), { fit: "cover", position: "attention" })
        .toBuffer();
      composites.push({ input: photoBuffer, left: Math.round(zone.x), top: Math.round(zone.y) });

      if (zone.gradientOverlay) {
        const gradientSvg = buildGradientOverlaySvg(Math.round(zone.width), Math.round(zone.height), zone.gradientOverlay);
        composites.push({ input: gradientSvg, left: Math.round(zone.x), top: Math.round(zone.y) });
      }
      continue;
    }

    if (!isTextZone(zone)) continue;

    // A blank/whitespace-only supplied value falls back to defaultValue too (not just a
    // missing key) — otherwise clearing a textarea silently drops fixed copy like a CTA.
    const supplied = zone.locked ? undefined : values[zone.id];
    const raw = supplied?.trim() ? supplied : zone.defaultValue ?? "";
    if (!raw.trim()) continue;

    const color = zone.color ?? "#FFFFFF";
    const highlightColor = zone.highlightColor ?? color;
    const prefixMarkup = zone.prefix
      ? `<span foreground="${highlightColor}">${escapePango(zone.prefix)}</span> `
      : "";
    const markup = prefixMarkup + buildHighlightMarkup(raw, color, highlightColor);

    // When a template doesn't pin a fixed alignment, follow the actual content's
    // script (Arabic -> right, Latin -> left) instead of defaulting to left —
    // otherwise Arabic text rendered into a template built for French (or vice
    // versa) ends up reading in the wrong direction.
    const align = zone.align ?? (isArabicText(raw) ? "right" : "left");

    const rendered = await renderRichText({
      text: markup,
      isMarkup: true,
      weight: zone.weight ?? "regular",
      box: { width: Math.round(zone.width), height: Math.round(zone.height) },
      align,
    });

    if (zone.pill) {
      // Pill hugs the actual rendered text size (CTA copy length varies), anchored
      // within the zone's box according to its alignment, rather than stretching
      // to fill the whole zone.
      const padX = 22;
      const padY = 12;
      const pillW = rendered.width + padX * 2;
      const pillH = rendered.height + padY * 2;
      const anchorLeft =
        align === "right"
          ? zone.x + zone.width - pillW
          : align === "center"
          ? zone.x + (zone.width - pillW) / 2
          : zone.x;

      const pillSvg = buildPillSvg({ width: pillW, height: pillH, color: zone.pillColor ?? color });
      composites.push({ input: pillSvg, left: Math.round(anchorLeft), top: Math.round(zone.y) });
      composites.push({ input: rendered.buffer, left: Math.round(anchorLeft + padX), top: Math.round(zone.y + padY) });
    } else {
      composites.push({ input: rendered.buffer, left: Math.round(zone.x), top: Math.round(zone.y) });
    }
  }

  const background = style.canvasBackground ? parseColor(style.canvasBackground) : { r: 0, g: 0, b: 0, alpha: 0 };

  const composed = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const outW = opts.outputWidth ?? canvasWidth;
  const outH = opts.outputHeight ?? canvasHeight;
  const format = opts.format ?? "jpeg";

  let pipeline = sharp(composed).resize(outW, outH, { fit: "cover" });

  if (opts.watermark?.logoPath) {
    const { logoPath, position } = opts.watermark;
    try {
      const logoWidth = Math.round(outW * 0.16);
      const logoBuffer = await sharp(logoPath).resize(logoWidth, logoWidth, { fit: "inside" }).toBuffer();
      const logoMeta = await sharp(logoBuffer).metadata();
      const lw = logoMeta.width ?? logoWidth;
      const lh = logoMeta.height ?? logoWidth;
      const margin = Math.round(outW * 0.035);
      const left = position.endsWith("right") ? outW - lw - margin : margin;
      const top = position.startsWith("bottom") ? outH - lh - margin : margin;
      pipeline = pipeline.composite([{ input: logoBuffer, left, top }]);
    } catch {
      // A missing/corrupt logo file shouldn't break the whole render -- just skip the watermark.
    }
  }

  pipeline = format === "png" ? pipeline.png() : pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 92 });

  return pipeline.toBuffer();
}
