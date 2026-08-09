import { useEffect, useRef, useState } from "react";
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
 *
 * Drag tracking happens on `window`, not just the container: many zones
 * (e.g. a photo zone meant to touch the image's edge) need to be dragged
 * right up to — or briefly past — the container boundary, and the mouse
 * button can legitimately be released outside it. Container-only listeners
 * would either cancel the drag the instant the cursor left the element or
 * leave it stuck if mouseup happened outside; tracking on `window` while a
 * drag is in progress avoids both.
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

  // Tracks the drag on `window` (not the container) once started, so it survives the
  // cursor moving outside the container's bounds and always ends cleanly on mouseup.
  useEffect(() => {
    if (!dragStart) return;

    function clientToContainer(clientX: number, clientY: number) {
      const box = containerRef.current!.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(box.width, clientX - box.left)),
        y: Math.max(0, Math.min(box.height, clientY - box.top)),
      };
    }

    function onMove(e: MouseEvent) {
      const p = clientToContainer(e.clientX, e.clientY);
      setDragRect({
        x: Math.min(dragStart!.x, p.x),
        y: Math.min(dragStart!.y, p.y),
        width: Math.abs(p.x - dragStart!.x),
        height: Math.abs(p.y - dragStart!.y),
      });
    }

    function onUp() {
      setDragStart(null);
      setDragRect((rect) => {
        if (rect && containerRef.current && activeZoneId && rect.width > 8 && rect.height > 8) {
          const { clientWidth, clientHeight } = containerRef.current;
          onChange(activeZoneId, toNatural(rect, clientWidth, clientHeight));
        }
        return null;
      });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragStart, activeZoneId]);

  const activeColor = zones.find((z) => z.id === activeZoneId)?.color ?? "#38bdf8";

  return (
    <div
      ref={containerRef}
      className={`relative select-none border border-neutral-700 rounded-md overflow-hidden ${
        activeZoneId ? "cursor-crosshair" : "cursor-default"
      }`}
      onMouseDown={handleMouseDown}
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
