import { useRef, useState } from "react";
import type { Rect } from "../lib/api.js";

type Mode = "image-slot" | "text-zone";

/**
 * Drag-to-define zone editor. Renders the uploaded template image at display
 * size, lets the user drag out a rectangle, and reports it back scaled to
 * the image's natural (full) resolution — which is what the render engine
 * operates in.
 */
export default function ZoneEditor({
  imageUrl,
  naturalWidth,
  naturalHeight,
  imageSlot,
  textZone,
  mode,
  onChange,
}: {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  imageSlot: Rect | null;
  textZone: Rect | null;
  mode: Mode;
  onChange: (mode: Mode, rect: Rect) => void;
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
    if (dragRect && containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (dragRect.width > 8 && dragRect.height > 8) {
        onChange(mode, toNatural(dragRect, clientWidth, clientHeight));
      }
    }
    setDragStart(null);
    setDragRect(null);
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none border border-neutral-700 rounded-md overflow-hidden cursor-crosshair"
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
        imageSlot &&
        (() => {
          const d = toDisplay(imageSlot, containerRef.current.clientWidth, containerRef.current.clientHeight);
          return (
            <div
              className="absolute border-2 border-emerald-400 bg-emerald-400/10"
              style={{ left: d.x, top: d.y, width: d.width, height: d.height }}
            >
              <span className="absolute -top-5 left-0 text-[10px] text-emerald-400">image slot</span>
            </div>
          );
        })()}

      {containerRef.current &&
        textZone &&
        (() => {
          const d = toDisplay(textZone, containerRef.current.clientWidth, containerRef.current.clientHeight);
          return (
            <div
              className="absolute border-2 border-sky-400 bg-sky-400/10"
              style={{ left: d.x, top: d.y, width: d.width, height: d.height }}
            >
              <span className="absolute -top-5 left-0 text-[10px] text-sky-400">text banner</span>
            </div>
          );
        })()}

      {dragRect && (
        <div
          className={`absolute border-2 border-dashed ${
            mode === "image-slot" ? "border-emerald-300" : "border-sky-300"
          }`}
          style={{ left: dragRect.x, top: dragRect.y, width: dragRect.width, height: dragRect.height }}
        />
      )}
    </div>
  );
}
