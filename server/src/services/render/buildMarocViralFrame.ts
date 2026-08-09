import sharp from "sharp";
import { MAROC_VIRAL_COLORS as C, MAROC_VIRAL_LAYOUT as L } from "./brand.js";
import { renderRichText } from "./richText.js";
import type { ZoneDef } from "../../types.js";

type Overlay = { input: string | Buffer; left: number; top: number };

function starPoints(cx: number, cy: number, outerR: number, innerR: number, points = 5): string {
  const step = Math.PI / points;
  let path = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + i * step;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    path += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
  }
  return path + "Z";
}

/** Small decorative dot-grid, used to echo the tech/futuristic corner texture in the reference mockups. */
function dotGrid(x: number, y: number, cols: number, rows: number, gap: number, color: string, opacity = 0.35): string {
  let dots = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots += `<circle cx="${x + c * gap}" cy="${y + r * gap}" r="2.2" fill="${color}" opacity="${opacity}" />`;
    }
  }
  return dots;
}

const HEART_PATH = (cx: number, cy: number, s: number) =>
  `M${cx},${cy + s * 0.3}
   C${cx - s},${cy - s * 0.6} ${cx - s * 1.6},${cy + s * 0.4} ${cx},${cy + s * 1.3}
   C${cx + s * 1.6},${cy + s * 0.4} ${cx + s},${cy - s * 0.6} ${cx},${cy + s * 0.3} Z`;

interface FooterItem {
  icon: "facebook" | "clock" | "heart" | "share";
  title: string;
  subtitle: string;
  color: string;
}

const FOOTER_COPY: Record<"ar" | "fr", FooterItem[]> = {
  ar: [
    { icon: "facebook", title: "Maroc VIRAL", subtitle: "تابعنا للمزيد", color: "#1877F2" },
    { icon: "clock", title: "أخبار حصرية", subtitle: "على مدار الساعة", color: C.green },
    { icon: "heart", title: "دعمك يهمنا", subtitle: "تفاعل وشارك", color: C.blue },
    { icon: "share", title: "شارك المنشور", subtitle: "ليصل لأكبر عدد", color: C.gold },
  ],
  fr: [
    { icon: "facebook", title: "Maroc VIRAL", subtitle: "Suivez-nous", color: "#1877F2" },
    { icon: "clock", title: "Actu", subtitle: "En temps réel", color: C.green },
    { icon: "heart", title: "Le Maroc", subtitle: "Autrement", color: C.blue },
    { icon: "share", title: "Partage", subtitle: "Si tu es d'accord", color: C.gold },
  ],
};

const TAGLINE: Record<"ar" | "fr", string> = {
  ar: "الأخبار المغربية التي تصنع الحدث !",
  fr: "L'ACTU MAROCAINE QUI FAIT LE BUZZ !",
};

export const CATEGORY_LABEL: Record<"ar" | "fr", string> = {
  ar: "أخبار المغرب",
  fr: "ACTU MAROC",
};

export const CTA_LABEL: Record<"ar" | "fr", string> = {
  ar: "← شارك رأيك في التعليقات",
  fr: "Lire la suite en commentaire →",
};

export interface MarocViralGeometry {
  canvas: number;
  contentBox: { x: number; y: number; width: number; height: number };
  zones: ZoneDef[];
}

/**
 * Layout for the "Maroc Viral" brand template, expressed as the generic
 * zone system: a photo zone (right panel) plus four text zones (left
 * panel) — category pill, headline, description, and a CTA pill — in the
 * same reusable shape any other template's zones use.
 */
export function marocViralGeometry(canvas = L.canvas, language: "ar" | "fr" = "fr"): MarocViralGeometry {
  const pad = 60;
  const contentBox = { x: pad, y: 330, width: canvas - pad * 2, height: 560 };
  const textPanelWidth = Math.round(contentBox.width * 0.52);
  const innerPad = 36;
  const align = language === "ar" ? "right" : "left";

  const categoryHeight = 56;
  const categoryGap = 14;
  const headlineHeight = 200;
  const headlineGap = 20;
  const descriptionHeight = 110;
  const descriptionGap = 16;
  const ctaHeight = 44;

  const zoneX = contentBox.x + innerPad;
  const zoneWidth = textPanelWidth - innerPad * 2;
  const categoryY = contentBox.y + innerPad;
  const headlineY = categoryY + categoryHeight + categoryGap;
  const descriptionY = headlineY + headlineHeight + headlineGap;
  const ctaY = descriptionY + descriptionHeight + descriptionGap;

  // The photo zone is composited on top of the frame (per the generic zone system,
  // the background artwork is the bottom layer), so its top/right/bottom edges must
  // stay inset from the content box's own border+glow, or the photo would visibly
  // paint over the inner half of that stroke on those three sides.
  const borderInset = L.borderWidth + 6;

  const zones: ZoneDef[] = [
    {
      id: "photo",
      label: "Photo",
      type: "photo",
      x: contentBox.x + textPanelWidth,
      y: contentBox.y + borderInset,
      width: contentBox.width - textPanelWidth - borderInset,
      height: contentBox.height - borderInset * 2,
    },
    {
      id: "category",
      label: "Category",
      type: "text",
      x: zoneX,
      y: categoryY,
      width: zoneWidth,
      height: categoryHeight,
      align,
      weight: "bold",
      color: C.textPrimary,
      highlightColor: C.green,
      prefix: "●",
      defaultValue: CATEGORY_LABEL[language],
    },
    {
      id: "headline",
      label: "Headline",
      type: "text",
      x: zoneX,
      y: headlineY,
      width: zoneWidth,
      height: headlineHeight,
      align,
      weight: "extrabold",
      color: C.textPrimary,
      highlightColor: C.green,
    },
    {
      id: "description",
      label: "Description",
      type: "text",
      x: zoneX,
      y: descriptionY,
      width: zoneWidth,
      height: descriptionHeight,
      align,
      weight: "regular",
      color: C.textSecondary,
    },
    {
      id: "cta",
      label: "Call to action",
      type: "text",
      x: zoneX,
      y: ctaY,
      width: zoneWidth,
      height: ctaHeight,
      align,
      weight: "bold",
      color: C.green,
      pill: true,
      pillColor: C.green,
      defaultValue: CTA_LABEL[language],
    },
  ];

  return { canvas, contentBox, zones };
}

/**
 * Builds the "Maroc Viral" branded frame as a transparent-centered PNG:
 * header logo + tagline, gradient-bordered content box (transparent hole
 * for the photo + text panel), decorative corner accents, and footer icon
 * row — everything the design system calls "fixed" (never changes between
 * posts). Composited LAST in the render pipeline so it stays crisp on top
 * of the photo and text.
 */
export async function buildMarocViralFrame(language: "ar" | "fr"): Promise<Buffer> {
  const size = L.canvas;
  const geo = marocViralGeometry(size, language);
  const { contentBox } = geo;

  const structuralSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${C.green}" />
        <stop offset="50%" stop-color="#00C853" />
        <stop offset="100%" stop-color="${C.blue}" />
      </linearGradient>
      <linearGradient id="cornerGreen" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${C.green}" />
        <stop offset="100%" stop-color="${C.greenDark}" />
      </linearGradient>
      <linearGradient id="cornerBlue" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${C.blueBright}" />
        <stop offset="100%" stop-color="${C.blue}" />
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- corner accents -->
    <polygon points="0,0 132,0 0,132" fill="url(#cornerGreen)" opacity="0.9" />
    <polygon points="${size},0 ${size - 132},0 ${size},132" fill="url(#cornerBlue)" opacity="0.9" />
    ${dotGrid(20, 150, 6, 3, 16, C.green)}
    ${dotGrid(size - 20 - 5 * 16, 150, 6, 3, 16, C.blue)}

    <!-- header underline -->
    <rect x="${size / 2 - 160}" y="270" width="320" height="4" rx="2" fill="url(#mainGradient)" />

    <!-- content box border (transparent hole inside, both text + photo panels) -->
    <rect x="${contentBox.x}" y="${contentBox.y}" width="${contentBox.width}" height="${contentBox.height}"
          rx="${L.borderRadius}" fill="none" stroke="url(#mainGradient)" stroke-width="${L.borderWidth}" filter="url(#glow)" />

    <!-- footer bracket accents -->
    <polygon points="0,${size} 90,${size} 0,${size - 90}" fill="url(#cornerGreen)" opacity="0.55" />
    <polygon points="${size},${size} ${size - 90},${size} ${size},${size - 90}" fill="url(#cornerBlue)" opacity="0.55" />

    <!-- footer separator -->
    <rect x="40" y="885" width="${size - 80}" height="1.5" fill="${C.textSecondary}" opacity="0.15" />

    <!-- bottom mark -->
    <path d="${starPoints(size / 2, size - 32, 16, 7)}" fill="${C.green}" opacity="0.9" />
  </svg>`;

  const structural = await sharp(Buffer.from(structuralSvg)).png().toBuffer();

  // Logo mark: gradient badge + white star + small "play" accent (echoes the reference's map+play icon).
  const badgeSize = 96;
  const badgeSvg = `<svg width="${badgeSize + 24}" height="${badgeSize + 24}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${C.green}" />
        <stop offset="100%" stop-color="${C.blue}" />
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="${badgeSize}" height="${badgeSize}" rx="24" fill="${C.bgSecondary}" stroke="url(#badgeGrad)" stroke-width="3" />
    <path d="${starPoints(8 + badgeSize / 2, 8 + badgeSize / 2, badgeSize * 0.3, badgeSize * 0.13)}" fill="#FFFFFF" />
    <circle cx="${badgeSize + 8}" cy="8" r="15" fill="${C.red}" />
    <polygon points="${badgeSize + 3},2 ${badgeSize + 3},14 ${badgeSize + 13},8" fill="#FFFFFF" />
  </svg>`;
  const badge = await sharp(Buffer.from(badgeSvg)).png().toBuffer();

  // Logo wordmark: "Maroc" (white) stacked over "VIRAL" (green), Montserrat.
  const logoTop = await renderRichText({
    text: "Maroc",
    weight: "extrabold",
    color: C.textPrimary,
    box: { width: 420, height: 90 },
    align: "left",
  });
  const logoBottom = await renderRichText({
    text: "VIRAL",
    weight: "extrabold",
    color: C.green,
    box: { width: 420, height: 100 },
    align: "left",
  });

  const tagline = await renderRichText({
    text: TAGLINE[language],
    weight: "bold",
    color: C.textSecondary,
    box: { width: 900, height: 50 },
    align: "center",
  });

  const logoX = 170;
  const composites: Overlay[] = [
    { input: structural, left: 0, top: 0 },
    { input: badge, left: 40, top: 36 },
    { input: logoTop.buffer, left: logoX, top: 30 },
    { input: logoBottom.buffer, left: logoX, top: 30 + logoTop.height - 10 },
    { input: tagline.buffer, left: Math.round((size - tagline.width) / 2), top: 205 },
  ];

  // Footer icons + two-line labels.
  const footerItems = FOOTER_COPY[language];
  const footerY = 940;
  const slotWidth = (size - 80) / footerItems.length;
  for (let i = 0; i < footerItems.length; i++) {
    const item = footerItems[i];
    const slotX = 40 + i * slotWidth;
    // local coordinates within the small per-icon SVG (0..slotWidth), composited at (slotX, footerY) below
    const iconCx = 26;
    const iconCy = 26;

    let iconSvg = "";
    if (item.icon === "facebook") {
      iconSvg = `<circle cx="${iconCx}" cy="${iconCy}" r="22" fill="${item.color}" />
        <text x="${iconCx}" y="${iconCy + 8}" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">f</text>`;
    } else if (item.icon === "clock") {
      iconSvg = `<circle cx="${iconCx}" cy="${iconCy}" r="22" fill="none" stroke="${item.color}" stroke-width="2.5" />
        <line x1="${iconCx}" y1="${iconCy}" x2="${iconCx}" y2="${iconCy - 11}" stroke="${item.color}" stroke-width="2.5" stroke-linecap="round" />
        <line x1="${iconCx}" y1="${iconCy}" x2="${iconCx + 8}" y2="${iconCy + 4}" stroke="${item.color}" stroke-width="2.5" stroke-linecap="round" />`;
    } else if (item.icon === "heart") {
      iconSvg = `<circle cx="${iconCx}" cy="${iconCy}" r="22" fill="none" stroke="${item.color}" stroke-width="2.5" />
        <path d="${HEART_PATH(iconCx, iconCy - 6, 7)}" fill="${item.color}" />`;
    } else {
      iconSvg = `<circle cx="${iconCx}" cy="${iconCy}" r="22" fill="${item.color}" />
        <polygon points="${iconCx - 9},${iconCy - 7} ${iconCx - 9},${iconCy + 7} ${iconCx + 10},${iconCy}" fill="${C.bgPrimary}" />`;
    }
    const iconBuf = await sharp(Buffer.from(`<svg width="52" height="60" xmlns="http://www.w3.org/2000/svg">${iconSvg}</svg>`))
      .png()
      .toBuffer();

    const isRtl = language === "ar";
    // RTL: icon on the right of its slot, label right-aligned to its left. LTR: mirror image of that.
    const iconLeft = isRtl ? slotX + slotWidth - 52 : slotX;
    const labelLeft = isRtl ? slotX : slotX + 56;

    composites.push({ input: iconBuf, left: Math.round(iconLeft), top: footerY });

    const label = await renderRichText({
      text: `${item.title}\n${item.subtitle}`,
      weight: "bold",
      color: C.textPrimary,
      box: { width: Math.round(slotWidth - 60), height: 60 },
      align: isRtl ? "right" : "left",
    });
    composites.push({
      input: label.buffer,
      left: Math.round(labelLeft),
      top: footerY + 4,
    });
  }

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
