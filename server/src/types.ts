export type ZoneAlign = "left" | "center" | "right";
export type FontWeight = "regular" | "bold" | "extrabold";

interface ZoneBase {
  /** Stable key used to address this zone from render requests and the editor UI, e.g. "headline". */
  id: string;
  /** Human label shown in the template editor, e.g. "Headline". */
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Locked zones always render their `defaultValue` (text zones) and are
   * not exposed as editable inputs in the client — for fixed-per-template
   * copy that never changes between posts.
   */
  locked?: boolean;
}

export interface TextZoneDef extends ZoneBase {
  type: "text";
  align?: ZoneAlign;
  weight?: FontWeight; // default "regular"
  color?: string; // default #FFFFFF
  /** Color applied to `**word**`-wrapped substrings within this zone's content. */
  highlightColor?: string;
  /** Used when locked, or as a placeholder/fallback when no value is supplied at render time. */
  defaultValue?: string;
  /** Fixed decorative text rendered in highlightColor before the value, e.g. "●" for a category dot. */
  prefix?: string;
  /** Draws a rounded pill outline behind the text (e.g. a CTA button look). */
  pill?: boolean;
  pillColor?: string;
}

export interface PhotoZoneDef extends ZoneBase {
  type: "photo";
}

export type ZoneDef = TextZoneDef | PhotoZoneDef;

export interface TemplateStyle {
  /** Base canvas fill, revealed anywhere the background artwork is transparent. Defaults to transparent. */
  canvasBackground?: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  /**
   * The uploaded background artwork. Rendered pixel-perfect as the bottom
   * layer — every zone (photo and text) composites strictly ON TOP of it,
   * so the artwork never needs a real alpha-transparent hole to work: a
   * fully flattened, opaque PNG/JPG export from any design tool is fine.
   */
  baseImagePath: string;
  canvasWidth: number;
  canvasHeight: number;
  /** Reusable layer system: any number of text/photo zones, in paint order. */
  zones: ZoneDef[];
  style: TemplateStyle;
  createdAt: string;
  updatedAt: string;
}

export function isTextZone(z: ZoneDef): z is TextZoneDef {
  return z.type === "text";
}

export function isPhotoZone(z: ZoneDef): z is PhotoZoneDef {
  return z.type === "photo";
}
