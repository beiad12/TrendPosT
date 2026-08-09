import { fitText } from "./textFit.js";
import type { TextZone, TemplateStyle } from "../../types.js";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Builds an SVG gradient-overlay + headline-text layer, sized to the full canvas. */
export function buildTextLayerSvg(params: {
  canvasWidth: number;
  canvasHeight: number;
  zone: TextZone;
  headline: string;
  style: TemplateStyle;
}): Buffer {
  const { canvasWidth, canvasHeight, zone, headline, style } = params;

  const gradId = "banner-gradient";
  const direction = style.gradientDirection ?? "to-top"; // gradient darkens toward the text
  const opacity = style.gradientOpacity ?? 0.75;

  const gradientCoords =
    direction === "to-top"
      ? { x1: "0%", y1: "100%", x2: "0%", y2: "0%" }
      : direction === "to-bottom"
      ? { x1: "0%", y1: "0%", x2: "0%", y2: "100%" }
      : direction === "to-left"
      ? { x1: "100%", y1: "0%", x2: "0%", y2: "0%" }
      : { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };

  const padding = Math.round(zone.width * 0.05);
  const innerWidth = zone.width - padding * 2;
  const innerHeight = zone.height - padding * 2;

  const { lines, fontSize, lineHeight } = fitText({
    text: headline,
    maxWidth: innerWidth,
    maxHeight: innerHeight,
    maxLines: 2,
    fontFamily: style.fontFamily,
  });

  const fontFamily = style.fontFamily ?? "Arial, 'Noto Sans Arabic', sans-serif";
  const fontColor = style.fontColor ?? "#ffffff";
  const fontWeight = style.fontWeight ?? 800;
  const align = zone.align ?? "left";

  const textAnchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const textX =
    align === "center"
      ? zone.x + zone.width / 2
      : align === "right"
      ? zone.x + zone.width - padding
      : zone.x + padding;

  const totalTextHeight = lines.length * lineHeight;
  const firstBaselineY = zone.y + zone.height - padding - totalTextHeight + fontSize * 0.85;

  const tspans = lines
    .map((line, i) => {
      const y = firstBaselineY + i * lineHeight;
      return `<text x="${textX}" y="${y}" text-anchor="${textAnchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fontColor}" stroke="rgba(0,0,0,0.35)" stroke-width="1" paint-order="stroke">${escapeXml(
        line
      )}</text>`;
    })
    .join("\n");

  return Buffer.from(`<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradId}" x1="${gradientCoords.x1}" y1="${gradientCoords.y1}" x2="${gradientCoords.x2}" y2="${gradientCoords.y2}">
        <stop offset="0%" stop-color="black" stop-opacity="${opacity}" />
        <stop offset="100%" stop-color="black" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="url(#${gradId})" />
    ${tspans}
  </svg>`);
}
