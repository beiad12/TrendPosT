import sharp from "sharp";
import type { ZoneDef } from "../../types.js";

export interface PressPosterGeometry {
  canvas: number;
  zones: ZoneDef[];
}

/**
 * Layout for the minimal "AI Auto Post" template — a classic full-bleed
 * press/social poster: photo covers the entire canvas, darkened at the
 * bottom for readability, headline overlaid on top. Just two zones (photo
 * + headline), no branding — the AI-driven flow's default output is
 * exactly "photo + headline", per spec.
 */
export function pressPosterGeometry(canvas = 1080): PressPosterGeometry {
  const pad = 64;
  const headlineHeight = Math.round(canvas * 0.3);

  const zones: ZoneDef[] = [
    {
      id: "photo",
      label: "Photo",
      type: "photo",
      x: 0,
      y: 0,
      width: canvas,
      height: canvas,
      gradientOverlay: { direction: "to-top", opacity: 0.88, bandFraction: 0.55 },
    },
    {
      id: "headline",
      label: "Headline",
      type: "text",
      x: pad,
      y: canvas - headlineHeight,
      width: canvas - pad * 2,
      height: headlineHeight - pad * 0.6,
      // no fixed `align` -- follows the actual headline's script (AR/FR/etc.) automatically
      weight: "extrabold",
      color: "#FFFFFF",
      highlightColor: "#39FF14",
    },
  ];

  return { canvas, zones };
}

/**
 * The background artwork for this template is just an empty transparent
 * canvas — the photo zone covers it completely (100% of the canvas), so
 * there's nothing else to draw. Kept as a real file (rather than special-
 * casing "no background") so it fits the same locked-background model
 * every other template uses.
 */
export async function buildPressPosterBackground(canvas = 1080): Promise<Buffer> {
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
}
