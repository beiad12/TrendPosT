/**
 * Lightweight, dependency-free auto-fit/auto-wrap text layout.
 * Uses an average glyph-width heuristic (per-font-size) since we don't have
 * a canvas text-measurement API available server-side without extra native
 * deps. This is accurate enough for headline banners (bold sans headlines,
 * 1-2 lines) and errs on the safe side (slightly conservative width).
 */

export interface FitTextOptions {
  text: string;
  maxWidth: number;
  maxHeight: number;
  maxLines?: number; // default 2
  minFontSize?: number; // default 22
  maxFontSize?: number; // default 88
  fontFamily?: string; // used only for the avg-char-width ratio lookup
  lineHeightRatio?: number; // default 1.2
}

export interface FitTextResult {
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

// Rough average glyph width as a fraction of font size, for bold sans faces.
// Arabic/Darija script tends to run a bit wider per glyph than Latin.
function avgCharWidthRatio(text: string): number {
  const hasArabic = /[؀-ۿ]/.test(text);
  return hasArabic ? 0.62 : 0.56;
}

function wrapAtFontSize(text: string, maxWidth: number, fontSize: number): string[] {
  const ratio = avgCharWidthRatio(text);
  const charWidth = fontSize * ratio;
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function fitText(opts: FitTextOptions): FitTextResult {
  const {
    text,
    maxWidth,
    maxHeight,
    maxLines = 2,
    minFontSize = 22,
    maxFontSize = 88,
    lineHeightRatio = 1.2,
  } = opts;

  let fontSize = maxFontSize;

  while (fontSize >= minFontSize) {
    const lines = wrapAtFontSize(text, maxWidth, fontSize);
    const lineHeight = fontSize * lineHeightRatio;
    const totalHeight = lines.length * lineHeight;

    if (lines.length <= maxLines && totalHeight <= maxHeight) {
      return { lines, fontSize, lineHeight };
    }
    fontSize -= 2;
  }

  // Fall back to the smallest allowed size, truncating to maxLines with ellipsis.
  const lines = wrapAtFontSize(text, maxWidth, minFontSize).slice(0, maxLines);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 3 ? last.slice(0, -3).trimEnd() + "…" : last;
  }
  return { lines, fontSize: minFontSize, lineHeight: minFontSize * lineHeightRatio };
}
