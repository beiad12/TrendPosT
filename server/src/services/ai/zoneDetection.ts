import sharp from "sharp";
import { getProviderApiKey } from "./keyVault.js";
import { ProviderKeyMissingError } from "./types.js";
import type { ZoneDef } from "../../types.js";

export interface DetectedZone {
  id: string;
  label: string;
  type: "text" | "photo";
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "left" | "center" | "right";
}

const SYSTEM_PROMPT = `You are a layout-analysis engine for a social-media post template
editor. You are shown a branded template image (a "frame") that has one or
more empty/placeholder areas where dynamic content will later be inserted:
usually one photo area, and several text areas such as a small category
label/badge, a large headline, a smaller description paragraph, and
sometimes a CTA button/pill. Not every template has all of these — only
report zones you can actually see evidence of (an empty box, a border
outline, placeholder text, a pill/button shape, an obviously blank region
inside an otherwise-decorated frame).

Respond with STRICT JSON only, no markdown fences, no commentary.`;

function buildUserPrompt(width: number, height: number): string {
  return `This template image is exactly ${width}x${height} pixels.

Identify each placeholder zone and return its bounding box in PIXEL
coordinates (0,0 = top-left corner of the image), using the schema below.
Order zones top-to-bottom in the order content should be read. If the
template's content reads right-to-left (Arabic script anywhere in visible
placeholder/label text, or the design is clearly RTL-oriented), set
"align": "right" for its text zones, otherwise "left" (or "center" for
anything visually centered, like a logo/title area — but do not report the
fixed logo/header/footer branding itself as a zone, only genuinely EMPTY
content placeholders).

{
  "zones": [
    {
      "id": string,            // short stable slug, e.g. "photo", "category", "headline", "description", "cta"
      "label": string,         // short human label, e.g. "Photo", "Headline"
      "type": "text" | "photo",
      "x": number, "y": number, "width": number, "height": number,  // pixel box, inset a few px from any border
      "align": "left" | "center" | "right"
    }
  ]
}

Return ONLY that JSON object.`;
}

function extractJson(text: string): any {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON object found in model response: ${text.slice(0, 300)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Uses Claude's vision to look at an uploaded template image and propose a
 * starting set of zones (photo + text placeholders) — a smart first draft
 * the user reviews/adjusts in the editor rather than dragging every
 * rectangle by hand.
 */
export async function detectTemplateZones(imageBuffer: Buffer): Promise<DetectedZone[]> {
  const apiKey = getProviderApiKey("anthropic");
  if (!apiKey) throw new ProviderKeyMissingError("anthropic");

  // Downscale oversized uploads before sending to the vision API (keeps latency/cost sane;
  // coordinates are mapped back to the original resolution afterwards).
  const original = sharp(imageBuffer);
  const meta = await original.metadata();
  const origWidth = meta.width ?? 1080;
  const origHeight = meta.height ?? 1080;

  const maxDim = 1568; // Anthropic's recommended max long-edge for vision inputs
  const scale = Math.min(1, maxDim / Math.max(origWidth, origHeight));
  const sendWidth = Math.round(origWidth * scale);
  const sendHeight = Math.round(origHeight * scale);

  const pngBuffer = await sharp(imageBuffer)
    .resize(sendWidth, sendHeight, { fit: "fill" })
    .png()
    .toBuffer();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: pngBuffer.toString("base64") } },
            { type: "text", text: buildUserPrompt(sendWidth, sendHeight) },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const data: any = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const parsed = extractJson(text);
  const rawZones: any[] = Array.isArray(parsed.zones) ? parsed.zones : [];

  const invScale = origWidth / sendWidth; // map back to full-resolution pixel coordinates
  const usedIds = new Set<string>();

  return rawZones
    .filter((z) => z && (z.type === "text" || z.type === "photo") && z.width > 0 && z.height > 0)
    .map((z, i): DetectedZone => {
      let id = String(z.id || `${z.type}-${i + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `zone-${i + 1}`;
      while (usedIds.has(id)) id = `${id}-${i + 1}`;
      usedIds.add(id);

      const x = clamp(Math.round(z.x * invScale), 0, origWidth - 1);
      const y = clamp(Math.round(z.y * invScale), 0, origHeight - 1);
      const width = clamp(Math.round(z.width * invScale), 1, origWidth - x);
      const height = clamp(Math.round(z.height * invScale), 1, origHeight - y);

      return {
        id,
        label: String(z.label || z.id || (z.type === "photo" ? "Photo" : "Text")).slice(0, 40),
        type: z.type,
        x,
        y,
        width,
        height,
        align: z.type === "text" ? (["left", "center", "right"].includes(z.align) ? z.align : "left") : undefined,
      };
    });
}

/** Converts detected zones into full ZoneDef objects with sensible default styling. */
export function detectedZonesToDefs(zones: DetectedZone[]): ZoneDef[] {
  return zones.map((z) => {
    if (z.type === "photo") {
      return { id: z.id, label: z.label, type: "photo", x: z.x, y: z.y, width: z.width, height: z.height };
    }
    const isCategory = /categor|badge|label|tag/i.test(z.id + z.label);
    const isCta = /cta|button|action|link/i.test(z.id + z.label);
    return {
      id: z.id,
      label: z.label,
      type: "text",
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      align: z.align ?? "left",
      weight: isCategory || isCta ? "bold" : "regular",
      color: "#FFFFFF",
      highlightColor: "#39FF14",
      pill: isCta || undefined,
      prefix: isCategory ? "●" : undefined,
    };
  });
}
