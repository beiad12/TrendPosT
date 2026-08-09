/** A rounded-rect outline behind a text zone (e.g. a CTA button look). */
export function buildPillSvg(opts: { width: number; height: number; color: string; strokeWidth?: number }): Buffer {
  const { width, height, color, strokeWidth = 2 } = opts;
  const radius = Math.min(height / 2, 24);
  const inset = strokeWidth;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${inset / 2}" y="${inset / 2}" width="${width - inset}" height="${height - inset}"
          rx="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />
  </svg>`);
}
