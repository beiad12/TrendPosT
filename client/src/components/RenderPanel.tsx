import { useEffect, useState } from "react";
import { api, Template } from "../lib/api.js";

/**
 * Shared "pick template -> headline -> photo -> render" panel used both from
 * the trend detail flow (headline pre-filled from a chosen caption/trend
 * title) and the Templates page (as a standalone preview tool).
 */
export default function RenderPanel({
  initialHeadline,
  initialPhotoUrl,
}: {
  initialHeadline?: string;
  initialPhotoUrl?: string;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [headline, setHeadline] = useState(initialHeadline ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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

  async function handleRender() {
    if (!templateId || !headline.trim()) {
      setError("Pick a template and enter a headline.");
      return;
    }
    if (!photoFile && !photoUrl.trim()) {
      setError("Provide a photo (upload or URL).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("templateId", templateId);
      form.set("headline", headline);
      form.set("outputWidth", "1080");
      form.set("outputHeight", "1080");
      form.set("format", "jpeg");
      if (photoFile) form.set("photo", photoFile);
      else form.set("photoUrl", photoUrl.trim());

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

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Headline</label>
          <textarea
            className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
            rows={3}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Auto-fit, auto-wrapped headline text…"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Photo URL (from trend source)</label>
          <input
            className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2"
            value={photoUrl}
            onChange={(e) => {
              setPhotoUrl(e.target.value);
              setPhotoFile(null);
            }}
            placeholder="https://…"
          />
        </div>

        <div className="text-center text-neutral-500 text-xs">— or —</div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Upload your own photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setPhotoFile(e.target.files?.[0] ?? null);
              if (e.target.files?.[0]) setPhotoUrl("");
            }}
            className="block w-full text-sm text-neutral-400"
          />
        </div>

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
