import { useEffect, useMemo, useState } from "react";
import { api, isPhotoZone, isTextZone, Template } from "../lib/api.js";

/**
 * Shared "pick template -> fill each zone -> render" panel used both from
 * the trend detail flow (some zones pre-filled from a chosen trend/caption)
 * and the Templates page (as a standalone preview tool). Fully generic:
 * it renders one input per zone the selected template defines (skipping
 * locked zones, which always use their fixed value), rather than assuming
 * a fixed headline/category/description shape.
 */
export default function RenderPanel({
  initialValues,
  initialPhotoUrls,
}: {
  initialValues?: Record<string, string>;
  initialPhotoUrls?: Record<string, string>;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(initialPhotoUrls ?? {});
  const [photoFiles, setPhotoFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    api.templates.list().then((r) => {
      setTemplates(r.templates);
      if (r.templates.length && !templateId) setTemplateId(r.templates[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const editableTextZones = (selectedTemplate?.zones ?? []).filter(isTextZone).filter((z) => !z.locked);
  const photoZones = (selectedTemplate?.zones ?? []).filter(isPhotoZone);

  async function handleRender() {
    if (!templateId) {
      setError("Pick a template.");
      return;
    }
    const missingPhoto = photoZones.find((z) => !photoFiles[z.id] && !photoUrls[z.id]?.trim());
    if (missingPhoto) {
      setError(`Provide a photo for "${missingPhoto.label}" (upload or URL).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("templateId", templateId);
      form.set("values", JSON.stringify(values));
      const remainingUrls: Record<string, string> = {};
      for (const zone of photoZones) {
        const file = photoFiles[zone.id];
        if (file) form.set(zone.id, file);
        else if (photoUrls[zone.id]?.trim()) remainingUrls[zone.id] = photoUrls[zone.id].trim();
      }
      form.set("photoUrls", JSON.stringify(remainingUrls));
      // outputWidth/outputHeight intentionally omitted -- the server defaults to a
      // 4K-scale export rather than the (much smaller) design canvas size.
      form.set("format", "jpeg");

      const blob = await api.render.render(form);
      setResultUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e.message ?? "Render failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Template</label>
          <select
            className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.length === 0 && <option value="">No templates yet — create one first</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>

        {editableTextZones.map((zone) => (
          <div key={zone.id}>
            <label className="block text-sm text-neutral-400 mb-1">{zone.label}</label>
            <textarea
              className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
              rows={zone.height > 150 ? 3 : 2}
              value={values[zone.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [zone.id]: e.target.value }))}
              placeholder={
                zone.defaultValue ||
                (zone.highlightColor ? "Wrap a word in **double asterisks** for the highlight color" : "")
              }
            />
          </div>
        ))}

        {photoZones.map((zone) => (
          <div key={zone.id} className="space-y-2 border-t border-neutral-800 pt-3">
            <p className="text-sm text-neutral-400">{zone.label}</p>
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
              value={photoUrls[zone.id] ?? ""}
              onChange={(e) => {
                setPhotoUrls((u) => ({ ...u, [zone.id]: e.target.value }));
                setPhotoFiles((f) => {
                  const next = { ...f };
                  delete next[zone.id];
                  return next;
                });
              }}
              placeholder="Photo URL — https://…"
            />
            <div className="text-center text-neutral-500 text-xs">— or —</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhotoFiles((files) => ({ ...files, [zone.id]: f }));
                  setPhotoUrls((u) => ({ ...u, [zone.id]: "" }));
                }
              }}
              className="block w-full text-sm text-neutral-400"
            />
          </div>
        ))}

        <button
          onClick={handleRender}
          disabled={busy || !templateId}
          className="w-full bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md py-2 font-medium"
        >
          {busy ? "Rendering…" : "Render post image"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="flex flex-col items-center justify-center bg-neutral-900 border border-neutral-800 rounded-md p-4 min-h-[280px]">
        {resultUrl ? (
          <>
            <img src={resultUrl} alt="Rendered post" className="max-w-full max-h-[420px] rounded-md shadow-lg" />
            <a
              href={resultUrl}
              download="maroc-viral-post.jpg"
              className="mt-3 text-sm text-maroc-red hover:underline"
            >
              Download image
            </a>
          </>
        ) : (
          <p className="text-neutral-500 text-sm text-center">
            Live preview will appear here after you render.
          </p>
        )}
      </div>
    </div>
  );
}
