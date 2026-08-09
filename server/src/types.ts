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
  style: TemplateStyle;
  createdAt: string;
  updatedAt: string;
}
