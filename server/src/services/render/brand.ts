/**
 * "Maroc Viral" design system — colors, gradients, and layout ratios,
 * transcribed verbatim from the brand's design-system spec so every
 * generated post keeps the same visual identity. This is the single
 * source of truth other modules (frame builder, render engine) read from.
 */

export const MAROC_VIRAL_COLORS = {
  bgPrimary: "#020B16", // Deep Navy
  bgSecondary: "#06182A", // Dark Blue
  textPrimary: "#FFFFFF", // Pure White
  textSecondary: "#D9E2EA", // Light Gray
  green: "#39FF14", // Viral Green
  greenDark: "#087A32", // Deep Green
  blue: "#00A8FF", // Electric Blue
  blueBright: "#0066FF", // Neon Blue
  gold: "#FFD21F", // Moroccan Gold
  red: "#FF3040", // News Red
} as const;

export const MAROC_VIRAL_GRADIENT = [MAROC_VIRAL_COLORS.green, "#00C853", MAROC_VIRAL_COLORS.blue] as const;
export const MAROC_VIRAL_BLUE_GRADIENT = [MAROC_VIRAL_COLORS.blueBright, MAROC_VIRAL_COLORS.blue] as const;

export const MAROC_VIRAL_LAYOUT = {
  canvas: 1080,
  headerRatio: 0.28,
  contentRatio: 0.6,
  footerRatio: 0.12,
  borderWidth: 3,
  borderRadius: 36,
} as const;
