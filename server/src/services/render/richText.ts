import sharp from "sharp";
import { pickFont } from "./fonts.js";

export function escapePango(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Converts `**highlighted**` markdown-style markup into a Pango markup
 * string with the wrapped portion colored `highlightColor` and the rest
 * `baseColor` — this is how a headline like
 *   "المغرب يواصل التقدم نحو **مستقبل أفضل!**"
 * gets its brand-green highlighted word, matching the design system rule
 * ("Highlighted words -> Viral Green").
 */
export function buildHighlightMarkup(text: string, baseColor: string, highlightColor: string): string {
  const parts = text.split(/\*\*(.+?)\*\*/g); // odd indices are highlighted
  return parts
    .map((chunk, i) => {
      if (!chunk) return "";
      const color = i % 2 === 1 ? highlightColor : baseColor;
      return `<span foreground="${color}">${escapePango(chunk)}</span>`;
    })
    .join("");
}

export interface RenderTextOptions {
  /** Plain text, or pre-built Pango markup (set isMarkup: true). */
  text: string;
  isMarkup?: boolean;
  weight: "regular" | "bold" | "extrabold";
  color?: string; // used when isMarkup is false
  box: { width: number; height: number };
  align?: "left" | "center" | "right";
}

export interface RenderedText {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Renders text (optionally Pango markup for multi-color spans) into a
 * transparent RGBA PNG buffer, auto-sized/auto-wrapped to fit `box` using
 * Pango's own font metrics (via sharp's built-in text renderer) — no
 * hand-rolled width heuristics, and correct Arabic shaping via the bundled
 * Cairo font. Script (Arabic vs Latin) is auto-detected to pick the right
 * brand font family.
 */
export async function renderRichText(opts: RenderTextOptions): Promise<RenderedText> {
  const { text, isMarkup, weight, color, box, align = "left" } = opts;
  const markup = isMarkup ? text : `<span foreground="${color ?? "#FFFFFF"}">${escapePango(text)}</span>`;
  const font = pickFont(text, weight);

  const pangoAlign = align === "center" ? "centre" : align;

  const buffer = await sharp({
    text: {
      text: markup,
      font: font.family,
      fontfile: font.file,
      rgba: true,
      width: box.width,
      height: box.height,
      align: pangoAlign,
      wrap: "word",
    },
  })
    .png()
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width ?? box.width, height: meta.height ?? box.height };
}
