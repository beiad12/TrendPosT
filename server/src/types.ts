export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextZone extends Rect {
  align?: "left" | "center" | "right";
}

export interface TemplateStyle {
  fontFamily?: string;
  fontColor?: string;
  fontWeight?: number;
  gradientDirection?: "to-top" | "to-bottom" | "to-left" | "to-right";
  gradientOpacity?: number; // 0-1
  /** Base canvas fill behind the frame/photo/text. Defaults to transparent for legacy templates. */
  canvasBackground?: string;
  /** Color for `**highlighted**` words within the headline (rich-content templates only). */
  highlightColor?: string;
  categoryColor?: string;
  descriptionColor?: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  baseImagePath: string; // frame PNG, composited last, transparent hole over the slot
  canvasWidth: number;
  canvasHeight: number;
  imageSlot: Rect;
  textZone: TextZone;
  /**
   * Optional rich-content zones (e.g. the "Maroc Viral" brand template):
   * a small category pill above the headline and a description paragraph
   * below it, rendered with real brand fonts (Cairo/Montserrat) via Pango
   * instead of the legacy gradient-banner headline-only path. When absent,
   * rendering falls back to the original single-headline-on-gradient
   * behavior for backward compatibility with user-uploaded templates.
   */
  categoryZone?: TextZone;
  descriptionZone?: TextZone;
  style: TemplateStyle;
  createdAt: string;
  updatedAt: string;
}
