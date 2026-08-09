import { useEffect, useState } from "react";
import { api, Rect, Template, TemplateStyle } from "../lib/api.js";
import ZoneEditor from "../components/ZoneEditor.js";
import RenderPanel from "../components/RenderPanel.js";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("news");
  const [mode, setMode] = useState<"image-slot" | "text-zone">("image-slot");
  const [imageSlot, setImageSlot] = useState<Rect | null>(null);
  const [textZone, setTextZone] = useState<Rect | null>(null);
  const [style, setStyle] = useState<TemplateStyle>({
    fontColor: "#ffffff",
    gradientDirection: "to-top",
    gradientOpacity: 0.75,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.templates.list().then((r) => setTemplates(r.templates));
  }

  useEffect(refresh, []);

  function handleFile(f: File | null) {
    setFile(f);
    setImageSlot(null);
    setTextZone(null);
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

  async function handleSave() {
    if (!file || !name.trim() || !imageSlot || !textZone) {
      setError("Upload an image, name the template, and draw both zones.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("category", category);
      form.set("imageSlot", JSON.stringify(imageSlot));
      form.set("textZone", JSON.stringify({ ...textZone, align: "left" }));
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

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold mb-1">Templates</h1>
        <p className="text-sm text-neutral-400 mb-4">
          Upload a branded frame (e.g. your "Maroc Viral" template), then drag out where the trend
          photo goes (image slot) and where the headline banner sits (text zone). The frame's
          border/branding stays on top of the photo in the final render.
        </p>

        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div>
            {!previewUrl ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-md h-64 cursor-pointer text-neutral-400 hover:border-neutral-500">
                <span>Click to upload a template image (PNG recommended)</span>
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
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setMode("image-slot")}
                      className={`text-xs px-3 py-1.5 rounded-md ${
                        mode === "image-slot" ? "bg-emerald-600" : "bg-neutral-800"
                      }`}
                    >
                      Draw image slot
                    </button>
                    <button
                      onClick={() => setMode("text-zone")}
                      className={`text-xs px-3 py-1.5 rounded-md ${
                        mode === "text-zone" ? "bg-sky-600" : "bg-neutral-800"
                      }`}
                    >
                      Draw text banner
                    </button>
                    <button onClick={() => handleFile(null)} className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 ml-auto">
                      Change image
                    </button>
                  </div>
                  <ZoneEditor
                    imageUrl={previewUrl}
                    naturalWidth={naturalSize.w}
                    naturalHeight={naturalSize.h}
                    imageSlot={imageSlot}
                    textZone={textZone}
                    mode={mode}
                    onChange={(m, rect) => (m === "image-slot" ? setImageSlot(rect) : setTextZone(rect))}
                  />
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
              <label className="block text-sm text-neutral-400 mb-1">Font color</label>
              <input
                type="color"
                value={style.fontColor}
                onChange={(e) => setStyle((s) => ({ ...s, fontColor: e.target.value }))}
                className="w-full h-9 bg-neutral-900 border border-neutral-700 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Gradient direction</label>
              <select
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
                value={style.gradientDirection}
                onChange={(e) => setStyle((s) => ({ ...s, gradientDirection: e.target.value as any }))}
              >
                <option value="to-top">Bottom → top (classic)</option>
                <option value="to-bottom">Top → bottom</option>
                <option value="to-left">Right → left</option>
                <option value="to-right">Left → right</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Gradient opacity: {style.gradientOpacity}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={style.gradientOpacity}
                onChange={(e) => setStyle((s) => ({ ...s, gradientOpacity: Number(e.target.value) }))}
                className="w-full"
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
              <p className="text-neutral-500">{t.category}</p>
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
