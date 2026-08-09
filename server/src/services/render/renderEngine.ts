import sharp from "sharp";
import type { Template } from "../../types.js";
import { buildTextLayerSvg } from "./svg.js";

export interface RenderOptions {
  template: Template;
  /** Absolute path to the source photo, or a Buffer if already fetched. */
  photo: string | Buffer;
  headline: string;
  /** Output size for the Facebook feed (e.g. 1080x1080). Defaults to the template canvas size. */
  outputWidth?: number;
  outputHeight?: number;
  format?: "png" | "jpeg";
}

/**
 * Renders the final branded post image:
 *   1. Photo, cover-fit and cropped into the template's image slot
 *   2. Gradient overlay + auto-fit/auto-wrap headline text on the text zone
 *   3. The template frame composited last, on top (border/branding stays crisp)
 *   4. Flattened + resized to the requested Facebook export size
 */
export async function renderPost(opts: RenderOptions): Promise<Buffer> {
  const { template, photo, headline } = opts;
  const { canvasWidth, canvasHeight, imageSlot, textZone, style, baseImagePath } = template;

  // 1. Photo, cover-fit + cropped to the exact slot dimensions.
  const photoBuffer = await sharp(photo)
    .resize(imageSlot.width, imageSlot.height, { fit: "cover", position: "attention" })
    .toBuffer();

  // 2. Text layer (gradient + headline), sized to the full canvas so it composites in place.
  const textLayerSvg = buildTextLayerSvg({
    canvasWidth,
    canvasHeight,
    zone: textZone,
    headline,
    style,
  });

  // Base canvas (transparent), then photo, then gradient+text, then the frame on top.
  const composed = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: photoBuffer, left: Math.round(imageSlot.x), top: Math.round(imageSlot.y) },
      { input: textLayerSvg, left: 0, top: 0 },
      { input: baseImagePath, left: 0, top: 0 }, // frame border stays on top, final flatten
    ])
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
