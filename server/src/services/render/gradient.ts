import type { GradientOverlay } from "../../types.js";

/**
 * A darkening gradient band over part of a photo, so overlaid text stays
 * readable — e.g. the bottom third of a full-bleed poster photo. The band
 * is sized to `bandFraction` of the zone and positioned at whichever edge
 * `direction` fades away from (e.g. "to-top" = dark band anchored at the
 * bottom, fading out toward the top).
 */
export function buildGradientOverlaySvg(width: number, height: number, overlay: GradientOverlay): Buffer {
  const { direction, opacity, color = "#000000", bandFraction = 0.45 } = overlay;

  let rectX = 0;
  let rectY = 0;
  let rectW = width;
  let rectH = height;
  let x1 = "0%";
  let y1 = "0%";
  let x2 = "0%";
  let y2 = "100%";

  if (direction === "to-top" || direction === "to-bottom") {
    rectH = height * bandFraction;
    if (direction === "to-top") {
      rectY = height - rectH; // band anchored at the bottom
      x1 = "0%"; y1 = "100%"; x2 = "0%"; y2 = "0%";
    } else {
      rectY = 0; // band anchored at the top
      x1 = "0%"; y1 = "0%"; x2 = "0%"; y2 = "100%";
    }
  } else {
    rectW = width * bandFraction;
    if (direction === "to-left") {
      rectX = width - rectW; // band anchored at the right
      x1 = "100%"; y1 = "0%"; x2 = "0%"; y2 = "0%";
    } else {
      rectX = 0; // band anchored at the left
      x1 = "0%"; y1 = "0%"; x2 = "100%"; y2 = "0%";
    }
  }

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        <stop offset="0%" stop-color="${color}" stop-opacity="${opacity}" />
        <stop offset="100%" stop-color="${color}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="url(#g)" />
  </svg>`);
}
