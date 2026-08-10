import sharp from "sharp";
import { MAROC_VIRAL_COLORS as C } from "./brand.js";
import { renderRichText } from "./richText.js";
import type { ZoneDef } from "../../types.js";

/**
 * Copy for the "Dramatic Story" poster's fixed pieces (kicker + share CTA),
 * per language. The headline itself is always the AI/user-supplied text —
 * only these two framing labels are baked in, same pattern as the
 * "Maroc Viral" brand template's ar/fr variants.
 */
const KICKER: Record<"ar" | "fr", string> = {
  ar: "قصة مثيرة",
  fr: "HISTOIRE CHOC",
};

const CTA: Record<"ar" | "fr", string> = {
  ar: "هل صُدمت؟ شارك!",
  fr: "Choqué(e) ? Partage !",
};

const RIBBON: Record<"ar" | "fr", string> = {
  ar: "حصري",
  fr: "EXCLUSIF",
};

export const DRAMATIC_TEMPLATE_NAME: Record<"ar" | "fr", string> = {
  ar: "Dramatic Story — قصة مثيرة (عربي)",
  fr: "Dramatic Story — Histoire Choc (Français)",
};

export interface DramaticGeometry {
  canvas: number;
  bannerHeight: number;
  zones: ZoneDef[];
}

/**
 * Layout for the "Dramatic Story" template — a cinematic, high-contrast
 * poster meant to stop the scroll: a red/black hazard-striped kicker
 * banner up top (with a corner "EXCLUSIVE" ribbon baked into the fixed
 * background art), a full-bleed photo underneath it with a heavy dark
 * vignette at the bottom for legibility, a huge bold headline sitting in
 * that dark band, and a small share-CTA pill beneath it. Expressed as the
 * same generic zone system every other template uses.
 */
export function dramaticGeometry(canvas = 1080, language: "ar" | "fr" = "fr"): DramaticGeometry {
  const bannerHeight = 132;
  const pad = 56;
  const align = language === "ar" ? "right" : "left";

  const ctaHeight = 46;
  const ctaGap = 18;
  const headlineHeight = 260;

  const ctaY = canvas - pad - ctaHeight;
  const headlineY = ctaY - ctaGap - headlineHeight;

  const zones: ZoneDef[] = [
    {
      id: "photo",
      label: "Photo",
      type: "photo",
      x: 0,
      y: bannerHeight,
      width: canvas,
      height: canvas - bannerHeight,
      gradientOverlay: { direction: "to-top", opacity: 0.94, bandFraction: 0.68, color: "#000000" },
    },
    {
      id: "kicker",
      label: "Kicker",
      type: "text",
      x: pad,
      y: 40,
      width: canvas - pad * 2 - 150, // leave room for the corner ribbon baked into the banner art
      height: bannerHeight - 60,
      align,
      weight: "extrabold",
      color: "#FFFFFF",
      highlightColor: C.gold,
      prefix: "■",
      defaultValue: KICKER[language],
    },
    {
      id: "headline",
      label: "Headline",
      type: "text",
      x: pad,
      y: headlineY,
      width: canvas - pad * 2,
      height: headlineHeight,
      align,
      weight: "extrabold",
      color: "#FFFFFF",
      highlightColor: C.red,
    },
    {
      id: "cta",
      label: "Share CTA",
      type: "text",
      x: pad,
      y: ctaY,
      width: canvas - pad * 2,
      height: ctaHeight,
      align,
      weight: "bold",
      color: C.gold,
      pill: true,
      pillColor: C.gold,
      defaultValue: CTA[language],
    },
  ];

  return { canvas, bannerHeight, zones };
}

/**
 * Builds the fixed background art: a black canvas, a red-to-black
 * hazard-striped banner across the top (the kicker zone sits on top of
 * it), and a small diagonal "EXCLUSIVE" ribbon in the banner's top-right
 * corner. Everything below the banner is left transparent — the photo
 * zone (see dramaticGeometry) covers that area completely at render time.
 */
export async function buildDramaticBackground(canvas = 1080, language: "ar" | "fr" = "fr"): Promise<Buffer> {
  const bannerHeight = 132;
  const stripeGap = 28;
  const stripeWidth = 14;

  let stripes = "";
  for (let x = -bannerHeight; x < canvas + bannerHeight; x += stripeGap) {
    stripes += `<polygon points="${x},0 ${x + stripeWidth},0 ${x + stripeWidth - bannerHeight},${bannerHeight} ${x - bannerHeight},${bannerHeight}" fill="#000000" opacity="0.22" />`;
  }

  const svg = `<svg width="${canvas}" height="${canvas}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${C.red}" />
        <stop offset="100%" stop-color="#8A0016" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${canvas}" height="${canvas}" fill="#000000" opacity="0" />
    <rect x="0" y="0" width="${canvas}" height="${bannerHeight}" fill="url(#bannerGrad)" />
    <g>${stripes}</g>
    <rect x="0" y="${bannerHeight - 6}" width="${canvas}" height="6" fill="${C.gold}" />
  </svg>`;

  const banner = await sharp(Buffer.from(svg)).png().toBuffer();

  // Corner ribbon ("EXCLUSIVE"/"حصري"), a small angled gold badge in the top-right of the banner —
  // baked into the background art since it's fixed decoration, not user-editable copy. The label
  // is rendered via renderRichText (bundled Cairo/Montserrat font files), not raw SVG <text>, so
  // Arabic shapes correctly regardless of what fonts happen to be installed system-wide.
  const ribbonWidth = 230;
  const ribbonSvg = `<svg width="${ribbonWidth}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="40,0 ${ribbonWidth},0 ${ribbonWidth},${bannerHeight} 0,${bannerHeight}" fill="${C.gold}" />
  </svg>`;
  const ribbon = await sharp(Buffer.from(ribbonSvg)).png().toBuffer();

  const ribbonLabel = await renderRichText({
    text: RIBBON[language],
    weight: "extrabold",
    color: "#1A0000",
    box: { width: ribbonWidth - 60, height: bannerHeight },
    align: "center",
  });

  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: banner, left: 0, top: 0 },
      { input: ribbon, left: canvas - ribbonWidth, top: 0 },
      {
        input: ribbonLabel.buffer,
        left: canvas - ribbonWidth + 40 + Math.round((ribbonWidth - 60 - ribbonLabel.width) / 2),
        top: Math.round((bannerHeight - ribbonLabel.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}
