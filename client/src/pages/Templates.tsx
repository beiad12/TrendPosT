import { useEffect, useState } from "react";
import { api, FontWeight, Rect, Template, TemplateStyle, ZoneAlign, ZoneDef } from "../lib/api.js";
import ZoneEditor, { EditorZone } from "../components/ZoneEditor.js";
import RenderPanel from "../components/RenderPanel.js";

type ZoneType = "text" | "photo";

interface EditableZone {
  id: string;
  label: string;
  type: ZoneType;
  rect: Rect | null;
  align: ZoneAlign;
  weight: FontWeight;
  color: string;
  highlightColor: string;
  locked: boolean;
  defaultValue: string;
  prefix: string;
  pill: boolean;
}

const ZONE_COLORS = ["#34d399", "#38bdf8", "#f59e0b", "#e879f9", "#f87171", "#a3e635", "#fb923c", "#818cf8"];

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "zone"
  );
}

function uniqueId(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function newZone(label: string, type: ZoneType, existing: EditableZone[]): EditableZone {
  return {
    id: uniqueId(slugify(label), existing.map((z) => z.id)),
    label,
    type,
    rect: null,
    align: "left",
    weight: type === "text" ? "regular" : "regular",
    color: "#ffffff",
    highlightColor: "#39FF14",
    locked: false,
    defaultValue: "",
    prefix: "",
    pill: false,
  };
}

const MAROC_VIRAL_PRESET = (): EditableZone[] => {
  const zones: EditableZone[] = [];
  zones.push({ ...newZone("Photo", "photo", zones) });
  zones.push({ ...newZone("Category", "text", zones), weight: "bold", defaultValue: "أخبار المغرب / ACTU MAROC", prefix: "●" });
  zones.push({ ...newZone("Headline", "text", zones), weight: "extrabold" });
  zones.push({ ...newZone("Description", "text", zones), color: "#D9E2EA" });
  zones.push({
    ...newZone("CTA", "text", zones),
    weight: "bold",
    color: "#39FF14",
    pill: true,
    locked: true,
    defaultValue: "Lire la suite en commentaire →",
  });
  return zones;
};

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("news");
  const [zones, setZones] = useState<EditableZone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [canvasBackground, setCanvasBackground] = useState("");
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.templates.list().then((r) => setTemplates(r.templates));
  }

  useEffect(refresh, []);

  function handleFile(f: File | null) {
    setFile(f);
    setZones([]);
    setActiveZoneId(null);
    if (!f) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  function addZone(type: ZoneType) {
    setZones((zs) => {
      const z = newZone(type === "photo" ? "Photo" : "Text zone", type, zs);
      setActiveZoneId(z.id);
      return [...zs, z];
    });
  }

  function updateZone(id: string, patch: Partial<EditableZone>) {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function removeZone(id: string) {
    setZones((zs) => zs.filter((z) => z.id !== id));
    if (activeZoneId === id) setActiveZoneId(null);
  }

  function applyPreset() {
    setZones(MAROC_VIRAL_PRESET());
    setActiveZoneId(null);
    setCanvasBackground("#020B16");
  }

  function zoneDefToEditable(z: ZoneDef): EditableZone {
    if (z.type === "photo") {
      return { ...newZone(z.label, "photo", []), id: z.id, label: z.label, rect: { x: z.x, y: z.y, width: z.width, height: z.height } };
    }
    return {
      ...newZone(z.label, "text", []),
      id: z.id,
      label: z.label,
      rect: { x: z.x, y: z.y, width: z.width, height: z.height },
      align: z.align ?? "left",
      weight: z.weight ?? "regular",
      color: z.color ?? "#ffffff",
      highlightColor: z.highlightColor ?? "#39FF14",
      locked: Boolean(z.locked),
      defaultValue: z.defaultValue ?? "",
      prefix: z.prefix ?? "",
      pill: Boolean(z.pill),
    };
  }

  async function handleAutoDetect() {
    if (!file) return;
    setDetecting(true);
    setError(null);
    try {
      const res = await api.templates.detectZones(file);
      setZones(res.zones.map(zoneDefToEditable));
      setCanvasBackground((bg) => bg || "#020B16");
      setActiveZoneId(null);
    } catch (e: any) {
      setError(
        e.message?.includes("missing_api_key")
          ? "Add your Anthropic API key in Settings to use AI zone detection."
          : e.message ?? "Zone detection failed"
      );
    } finally {
      setDetecting(false);
    }
  }

  async function handleSave() {
    if (!file || !name.trim() || zones.length === 0) {
      setError("Upload an image, name the template, and add at least one zone.");
      return;
    }
    const missingRect = zones.find((z) => !z.rect);
    if (missingRect) {
      setError(`Draw a position for "${missingRect.label}" on the image.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const zoneDefs: ZoneDef[] = zones.map((z) => {
        const base = { id: z.id, label: z.label, ...(z.rect as Rect), locked: z.locked || undefined };
        if (z.type === "photo") {
          return { ...base, type: "photo" as const };
        }
        return {
          ...base,
          type: "text" as const,
          align: z.align,
          weight: z.weight,
          color: z.color,
          highlightColor: z.highlightColor,
          defaultValue: z.defaultValue || undefined,
          prefix: z.prefix || undefined,
          pill: z.pill || undefined,
          pillColor: z.pill ? z.color : undefined,
        };
      });

      const style: TemplateStyle = {};
      if (canvasBackground.trim()) style.canvasBackground = canvasBackground.trim();

      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("category", category);
      form.set("zones", JSON.stringify(zoneDefs));
      form.set("style", JSON.stringify(style));

      await api.templates.create(form);
      setName("");
      handleFile(null);
      refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to save template");
    } finally {
      setBusy(false);
    }
  }

  const editorZones: EditorZone[] = zones.map((z, i) => ({
    id: z.id,
    label: z.label,
    rect: z.rect,
    color: ZONE_COLORS[i % ZONE_COLORS.length],
  }));

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold mb-1">Templates</h1>
        <p className="text-sm text-neutral-400 mb-4">
          Upload your own branded artwork — it's kept pixel-perfect as the locked background. Add as
          many text/photo zones as your design needs and drag each one into place; every zone
          composites strictly on top of the artwork, so your file never needs any special
          transparency to work.
        </p>

        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          <div>
            {!previewUrl ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-md h-64 cursor-pointer text-neutral-400 hover:border-neutral-500">
                <span>Click to upload a template image (PNG or JPG)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              naturalSize && (
                <>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={handleAutoDetect}
                      disabled={detecting}
                      className="text-xs px-3 py-1.5 rounded-md bg-maroc-red hover:bg-red-700 disabled:opacity-50 font-medium"
                    >
                      {detecting ? "Analyzing with AI…" : "✨ Auto-detect zones with AI"}
                    </button>
                    <button onClick={() => addZone("photo")} className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700">
                      + Photo zone
                    </button>
                    <button onClick={() => addZone("text")} className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700">
                      + Text zone
                    </button>
                    <button onClick={applyPreset} className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700">
                      Quick add: Maroc Viral layout (Photo/Category/Headline/Description/CTA)
                    </button>
                    <button onClick={() => handleFile(null)} className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 ml-auto">
                      Change image
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">
                    Auto-detect uses Claude's vision to propose a starting layout from your image —
                    review and adjust the zones below (drag to redraw any of them) before saving.
                  </p>
                  <ZoneEditor
                    imageUrl={previewUrl}
                    naturalWidth={naturalSize.w}
                    naturalHeight={naturalSize.h}
                    zones={editorZones}
                    activeZoneId={activeZoneId}
                    onChange={(id, rect) => updateZone(id, { rect })}
                  />

                  <div className="mt-4 space-y-2">
                    {zones.length === 0 && (
                      <p className="text-sm text-neutral-500">
                        No zones yet — add a photo/text zone above, or use the quick-add preset.
                      </p>
                    )}
                    {zones.map((z, i) => (
                      <div
                        key={z.id}
                        className={`rounded-md border p-3 ${
                          activeZoneId === z.id ? "border-neutral-500 bg-neutral-800/60" : "border-neutral-800 bg-neutral-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }}
                          />
                          <input
                            className="flex-1 bg-transparent border-b border-neutral-700 text-sm font-medium px-1 py-0.5"
                            value={z.label}
                            onChange={(e) => updateZone(z.id, { label: e.target.value })}
                          />
                          <span className="text-xs text-neutral-500">{z.type}</span>
                          <button
                            onClick={() => setActiveZoneId(z.id)}
                            className={`text-xs px-2 py-1 rounded ${
                              activeZoneId === z.id ? "bg-sky-600" : "bg-neutral-800 hover:bg-neutral-700"
                            }`}
                          >
                            {z.rect ? "Redraw" : "Draw"}
                          </button>
                          <button onClick={() => removeZone(z.id)} className="text-xs px-2 py-1 rounded bg-red-900/60 hover:bg-red-800">
                            Delete
                          </button>
                        </div>

                        {z.type === "text" && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="flex flex-col gap-1">
                              Align
                              <select
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
                                value={z.align}
                                onChange={(e) => updateZone(z.id, { align: e.target.value as ZoneAlign })}
                              >
                                <option value="left">Left (Latin)</option>
                                <option value="right">Right (Arabic)</option>
                                <option value="center">Center</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              Weight
                              <select
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
                                value={z.weight}
                                onChange={(e) => updateZone(z.id, { weight: e.target.value as FontWeight })}
                              >
                                <option value="regular">Regular</option>
                                <option value="bold">Bold</option>
                                <option value="extrabold">Extra bold</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              Color
                              <input
                                type="color"
                                value={z.color}
                                onChange={(e) => updateZone(z.id, { color: e.target.value })}
                                className="h-7 bg-neutral-950 border border-neutral-700 rounded"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Highlight (**word**)
                              <input
                                type="color"
                                value={z.highlightColor}
                                onChange={(e) => updateZone(z.id, { highlightColor: e.target.value })}
                                className="h-7 bg-neutral-950 border border-neutral-700 rounded"
                              />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1">
                              Default / locked value
                              <input
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
                                value={z.defaultValue}
                                onChange={(e) => updateZone(z.id, { defaultValue: e.target.value })}
                                placeholder="Shown when no value is supplied at render time"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Prefix icon
                              <input
                                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
                                value={z.prefix}
                                onChange={(e) => updateZone(z.id, { prefix: e.target.value })}
                                placeholder="e.g. ●"
                              />
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={z.locked}
                                onChange={(e) => updateZone(z.id, { locked: e.target.checked })}
                              />
                              Locked (always use default)
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input type="checkbox" checked={z.pill} onChange={(e) => updateZone(z.id, { pill: e.target.checked })} />
                              Pill / button background
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Name</label>
              <input
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maroc Viral — News"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Category</label>
              <select
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="news">News</option>
                <option value="sports">Sports</option>
                <option value="meme">Meme</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Canvas background (only matters if your artwork has transparent areas)
              </label>
              <input
                type="text"
                value={canvasBackground}
                onChange={(e) => setCanvasBackground(e.target.value)}
                placeholder="#020B16"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={busy}
              className="w-full bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md py-2 font-medium"
            >
              {busy ? "Saving…" : "Save template"}
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Saved templates ({templates.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {templates.map((t) => (
            <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded-md p-2 text-xs">
              <p className="font-medium truncate">{t.name}</p>
              <p className="text-neutral-500">
                {t.category} · {t.zones.length} zone{t.zones.length === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Preview / export</h2>
        <RenderPanel />
      </section>
    </div>
  );
}
