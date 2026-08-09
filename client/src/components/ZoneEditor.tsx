import { useRef, useState } from "react";
import type { Rect } from "../lib/api.js";

export interface EditorZone {
  id: string;
  label: string;
  rect: Rect | null;
  color: string; // any valid CSS color, used for border/label/drag-preview
}

/**
 * Drag-to-define zone editor. Renders the uploaded template image at display
 * size, lets the user drag out a rectangle for whichever zone is currently
 * active, and reports it back scaled to the image's natural (full)
 * resolution — which is what the render engine operates in. Works with any
 * number of zones (not a fixed set), each carrying its own display color.
 */
export default function ZoneEditor({
  imageUrl,
  naturalWidth,
  naturalHeight,
  zones,
  activeZoneId,
  onChange,
}: {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  zones: EditorZone[];
  activeZoneId: string | null;
  onChange: (zoneId: string, rect: Rect) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);

  function toNatural(rect: Rect, displayW: number, displayH: number): Rect {
    const scaleX = naturalWidth / displayW;
    const scaleY = naturalHeight / displayH;
    return {
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      width: Math.round(rect.width * scaleX),
      height: Math.round(rect.height * scaleY),
    };
  }

  function toDisplay(rect: Rect, displayW: number, displayH: number): Rect {
    const scaleX = displayW / naturalWidth;
    const scaleY = displayH / naturalHeight;
    return {
      x: rect.x * scaleX,
      y: rect.y * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!activeZoneId) return;
    const rect = containerRef.current!.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragRect(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragStart) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragRect({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y),
    });
  }

  function handleMouseUp() {
    if (dragRect && containerRef.current && activeZoneId) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (dragRect.width > 8 && dragRect.height > 8) {
        onChange(activeZoneId, toNatural(dragRect, clientWidth, clientHeight));
      }
    }
    setDragStart(null);
    setDragRect(null);
  }

  const activeColor = zones.find((z) => z.id === activeZoneId)?.color ?? "#38bdf8";

  return (
    <div
      ref={containerRef}
      className={`relative select-none border border-neutral-700 rounded-md overflow-hidden ${
        activeZoneId ? "cursor-crosshair" : "cursor-default"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDragStart(null);
        setDragRect(null);
      }}
    >
      <img src={imageUrl} alt="Template" className="w-full block pointer-events-none" draggable={false} />

      {containerRef.current &&
        zones.map((zone) => {
          if (!zone.rect) return null;
          const d = toDisplay(zone.rect, containerRef.current!.clientWidth, containerRef.current!.clientHeight);
          const isActive = zone.id === activeZoneId;
          return (
            <div
              key={zone.id}
              className="absolute"
              style={{
                left: d.x,
                top: d.y,
                width: d.width,
                height: d.height,
                border: `2px solid ${zone.color}`,
                backgroundColor: `${zone.color}1a`,
                boxShadow: isActive ? `0 0 0 2px ${zone.color}` : undefined,
              }}
            >
              <span
                className="absolute -top-5 left-0 text-[10px] font-medium"
                style={{ color: zone.color }}
              >
                {zone.label}
              </span>
            </div>
          );
        })}

      {dragRect && (
        <div
          className="absolute border-2 border-dashed"
          style={{ left: dragRect.x, top: dragRect.y, width: dragRect.width, height: dragRect.height, borderColor: activeColor }}
        />
      )}

      {!activeZoneId && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-neutral-200 pointer-events-none">
          Select a zone below, then drag on the image to place it
        </div>
      )}
    </div>
  );
}
