import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Absolute paths to bundled brand font files (npm packages, no OS-level
 * font installation required). Passed as sharp's `fontfile` option so text
 * renders identically on any machine the server runs on — Windows/macOS/
 * Linux, dev or prod — with correct Arabic shaping (Cairo) and no
 * dependency on what happens to be installed system-wide.
 */
export const FONTS = {
  cairoRegular: require.resolve("@fontsource/cairo/files/cairo-arabic-400-normal.woff"),
  cairoBold: require.resolve("@fontsource/cairo/files/cairo-arabic-700-normal.woff"),
  cairoExtraBold: require.resolve("@fontsource/cairo/files/cairo-arabic-800-normal.woff"),
  montserratRegular: require.resolve("@fontsource/montserrat/files/montserrat-latin-400-normal.woff"),
  montserratExtraBold: require.resolve("@fontsource/montserrat/files/montserrat-latin-800-normal.woff"),
  montserratBlack: require.resolve("@fontsource/montserrat/files/montserrat-latin-900-normal.woff"),
} as const;

const ARABIC_RE = /[؀-ۿݐ-ݿ]/;

export function isArabicText(text: string): boolean {
  return ARABIC_RE.test(text);
}

/** Picks the right brand font (family name + bundled file) for a given weight, based on script. */
export function pickFont(text: string, weight: "regular" | "bold" | "extrabold"): { family: string; file: string } {
  if (isArabicText(text)) {
    if (weight === "extrabold") return { family: "Cairo ExtraBold", file: FONTS.cairoExtraBold };
    if (weight === "bold") return { family: "Cairo Bold", file: FONTS.cairoBold };
    return { family: "Cairo", file: FONTS.cairoRegular };
  }
  if (weight === "extrabold") return { family: "Montserrat Black", file: FONTS.montserratBlack };
  if (weight === "bold") return { family: "Montserrat ExtraBold", file: FONTS.montserratExtraBold };
  return { family: "Montserrat", file: FONTS.montserratRegular };
}
