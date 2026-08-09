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
  /** Output size. Defaults to a 4K-scale render (see computeDefaultOutputSize) — not the raw template canvas size, which would look soft on a modern Facebook feed. */
  outputWidth?: number;
  outputHeight?: number;
  format?: "png" | "jpeg";
  /** Page logo, stamped on top of every zone, in every render, regardless of template. */
  watermark?: { logoPath: string; position: "bottom-right" | "bottom-left" | "top-right" | "top-left" };
}

/**
 * A template's zones are authored at a modest design-canvas size (e.g.
 * 1080x1080, easy to eyeball while building a layout), but that is not
 * final export quality — Facebook recompresses it and any downstream
 * cropping/zooming shows softness. The final export defaults to a true 4K
 * scale (3840px on the long edge, UHD) unless the caller asks for a
 * specific size, with the template's aspect ratio preserved.
 */
export const DEFAULT_OUTPUT_LONG_EDGE = 3840;

export function computeDefaultOutputSize(canvasWidth: number, canvasHeight: number): { width: number; height: number } {
  const scale = DEFAULT_OUTPUT_LONG_EDGE / Math.max(canvasWidth, canvasHeight);
  return { width: Math.round(canvasWidth * scale), height: Math.round(canvasHeight * scale) };
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
 *   3. Everything above renders NATIVELY at the final export resolution
 *      (see the `scale` factor below) rather than being composited small
 *      and stretched up afterward — text (Pango) and SVG layers (pill,
 *      gradient) are resolution-independent and stay crisp at any size,
 *      and photo zones are resampled directly from their original
 *      resolution straight to the final pixel size, so quality is bounded
 *      by the *source* photo/artwork, not by an extra blur-inducing
 *      upscale pass. Only the background artwork's own native resolution
 *      is a hard ceiling (a 1080px upload can't invent detail beyond
 *      1080px), but sharp's lanczos3 resampling makes the most of it.
 */
export async function renderPost(opts: RenderOptions): Promise<Buffer> {
  const { template, values = {}, photos = {} } = opts;
  const { canvasWidth, canvasHeight, zones, style, baseImagePath } = template;

  const defaultSize = computeDefaultOutputSize(canvasWidth, canvasHeight);
  const outW = opts.outputWidth ?? defaultSize.width;
  const outH = opts.outputHeight ?? defaultSize.height;
  const format = opts.format ?? "jpeg";

  // Cover-style uniform scale: guarantees the scaled canvas fully covers the
  // requested output size even if its aspect ratio doesn't exactly match
  // the template's (the final .resize({fit:"cover"}) below then just crops
  // rather than upscaling further).
  const scale = Math.max(outW / canvasWidth, outH / canvasHeight);
  const renderW = Math.round(canvasWidth * scale);
  const renderH = Math.round(canvasHeight * scale);
  const sx = (x: number) => Math.round(x * scale);
  const sy = (y: number) => Math.round(y * scale);

  const backgroundBuffer = await sharp(baseImagePath)
    .resize(renderW, renderH, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .toBuffer();
  const composites: Overlay[] = [{ input: backgroundBuffer, left: 0, top: 0 }];

  for (const zone of zones) {
    if (isPhotoZone(zone)) {
      const photoInput = photos[zone.id];
      if (!photoInput) continue; // no photo supplied for this zone -> background artwork shows through
      const zoneW = sx(zone.width);
      const zoneH = sy(zone.height);
      const photoBuffer = await sharp(photoInput)
        .resize(zoneW, zoneH, { fit: "cover", position: "attention", kernel: sharp.kernel.lanczos3 })
        .toBuffer();
      composites.push({ input: photoBuffer, left: sx(zone.x), top: sy(zone.y) });

      if (zone.gradientOverlay) {
        const gradientSvg = buildGradientOverlaySvg(zoneW, zoneH, zone.gradientOverlay);
        composites.push({ input: gradientSvg, left: sx(zone.x), top: sy(zone.y) });
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
      box: { width: sx(zone.width), height: sy(zone.height) },
      align,
    });

    if (zone.pill) {
      // Pill hugs the actual rendered text size (CTA copy length varies), anchored
      // within the zone's box according to its alignment, rather than stretching
      // to fill the whole zone.
      const padX = Math.round(22 * scale);
      const padY = Math.round(12 * scale);
      const pillW = rendered.width + padX * 2;
      const pillH = rendered.height + padY * 2;
      const zoneLeft = sx(zone.x);
      const zoneWidth = sx(zone.width);
      const anchorLeft =
        align === "right" ? zoneLeft + zoneWidth - pillW : align === "center" ? zoneLeft + (zoneWidth - pillW) / 2 : zoneLeft;

      const pillSvg = buildPillSvg({ width: pillW, height: pillH, color: zone.pillColor ?? color, strokeWidth: Math.max(2, Math.round(2 * scale)) });
      composites.push({ input: pillSvg, left: Math.round(anchorLeft), top: sy(zone.y) });
      composites.push({ input: rendered.buffer, left: Math.round(anchorLeft + padX), top: sy(zone.y) + padY });
    } else {
      composites.push({ input: rendered.buffer, left: sx(zone.x), top: sy(zone.y) });
    }
  }

  const background = style.canvasBackground ? parseColor(style.canvasBackground) : { r: 0, g: 0, b: 0, alpha: 0 };

  const composed = await sharp({
    create: { width: renderW, height: renderH, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toBuffer();

  let pipeline = sharp(composed).resize(outW, outH, { fit: "cover", kernel: sharp.kernel.lanczos3 });

  if (opts.watermark?.logoPath) {
    const { logoPath, position } = opts.watermark;
    try {
      const logoWidth = Math.round(outW * 0.16);
      const logoBuffer = await sharp(logoPath).resize(logoWidth, logoWidth, { fit: "inside", kernel: sharp.kernel.lanczos3 }).toBuffer();
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

  pipeline =
    format === "png"
      ? pipeline.png({ compressionLevel: 9 })
      : pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true });

  return pipeline.toBuffer();
}
