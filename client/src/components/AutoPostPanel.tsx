import { useEffect, useState } from "react";
import { api, AutoPostResult, Language, PhotoSource, Provider, PROVIDER_LABELS, Template, Trend } from "../lib/api.js";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "darija", label: "Darija" },
  { value: "french", label: "French" },
  { value: "msa", label: "MSA Arabic" },
  { value: "english", label: "English" },
];

const PROVIDERS: Provider[] = ["anthropic", "openai", "mistral", "google", "xai"];

type Style = "standard" | "dramatic";

/**
 * Template names the seeded "Dramatic Story" templates are inserted under
 * (see server/src/services/render/buildDramaticFrame.ts). Matched against
 * the fetched template list by name rather than a hardcoded id, since ids
 * are only assigned at seed time.
 */
const DRAMATIC_TEMPLATE_NAME: Record<"ar" | "fr" | "en", string> = {
  ar: "Dramatic Story — قصة مثيرة (عربي)",
  fr: "Dramatic Story — Histoire Choc (Français)",
  en: "Dramatic Story — Shocking Story (English)",
};

/** Darija and MSA both write Arabic script, French is Latin, English gets its own copy. */
function scriptFor(language: Language): "ar" | "fr" | "en" {
  if (language === "french") return "fr";
  if (language === "english") return "en";
  return "ar";
}

const PHOTO_SOURCE_LABEL: Record<PhotoSource, string> = {
  provided: "📷 Photo from the trend's own source",
  "web-search": "🌐 Photo found via web image search",
  "ai-generated": "🤖 AI-generated photo (no real photo was found)",
};

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * The one-click AI pipeline: trend photo + AI-written headline, rendered
 * together automatically. No manual photo upload, no manual text entry —
 * everything but the template's fixed layout comes from the trend and the
 * AI in a single request. When the trend has no photo of its own, the
 * server tries a web image search, then AI-generates one as a last resort
 * (see autoPost.ts#resolvePhoto) — so generation is never blocked on a
 * missing photo, it just tells you afterward where the photo came from.
 */
export default function AutoPostPanel({
  trend,
  defaultLanguage = "french",
  defaultStyle = "standard",
}: {
  trend: Trend;
  defaultLanguage?: Language;
  defaultStyle?: Style;
}) {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const [style, setStyle] = useState<Style>(defaultStyle);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoPostResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const hasPhoto = Boolean(trend.imageUrl);

  useEffect(() => {
    api.templates.list().then((r) => setTemplates(r.templates)).catch(() => {});
  }, []);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const dramaticTemplateId =
        style === "dramatic"
          ? templates.find((t) => t.name === DRAMATIC_TEMPLATE_NAME[scriptFor(language)])?.id
          : undefined;

      const res = await api.autoPost.generate({
        trend: {
          title: trend.title,
          sourceUrl: trend.url,
          source: trend.source,
          category: trend.category,
          imageUrl: trend.imageUrl,
          score: trend.score,
          sourceCount: trend.sourceCount,
          publishedAt: trend.publishedAt ?? undefined,
        },
        provider,
        language,
        templateId: dramaticTemplateId,
      });
      setResult(res);
      setImageUrl(URL.createObjectURL(base64ToBlob(res.imageBase64, `image/${res.format}`)));
    } catch (e: any) {
      setError(
        e.message?.includes("missing_api_key")
          ? `Add your ${PROVIDER_LABELS[provider]} API key in Settings first.`
          : e.message ?? "Auto-post generation failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        {!hasPhoto && !result && (
          <p className="text-amber-400 text-sm bg-amber-950/40 border border-amber-800 rounded-md p-2.5">
            This trend has no photo captured from its source — generating will try a web image search, then
            AI-generate one if nothing turns up (needs an Unsplash and/or OpenAI key in Settings).
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStyle("standard")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition ${
              style === "standard"
                ? "border-maroc-red bg-neutral-800"
                : "border-neutral-700 bg-neutral-800/40 text-neutral-400 hover:text-white"
            }`}
          >
            <span className="block font-medium">📰 Standard</span>
            <span className="block text-xs opacity-75">Full photo + clean headline</span>
          </button>
          <button
            type="button"
            onClick={() => setStyle("dramatic")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition ${
              style === "dramatic"
                ? "border-maroc-red bg-neutral-800"
                : "border-neutral-700 bg-neutral-800/40 text-neutral-400 hover:text-white"
            }`}
          >
            <span className="block font-medium">🎬 Dramatic Story</span>
            <span className="block text-xs opacity-75">Kicker banner + heavy vignette + share CTA</span>
          </button>
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          className="w-full bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md py-2.5 font-medium"
        >
          {busy ? "Generating…" : "✨ Generate AI post (photo + headline)"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result && (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-neutral-400">{PHOTO_SOURCE_LABEL[result.photoSource]}</p>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Caption</p>
              <p className="whitespace-pre-wrap bg-neutral-800/60 rounded-md p-2.5">{result.caption}</p>
            </div>
            <p className="text-maroc-red">{result.hashtags.join(" ")}</p>
            {result.suggestedPostTime && <p className="text-xs text-neutral-400">⏰ {result.suggestedPostTime}</p>}
            <button
              className="text-xs underline text-neutral-400 hover:text-white"
              onClick={() => navigator.clipboard.writeText(`${result.caption}\n\n${result.hashtags.join(" ")}`)}
            >
              Copy caption + hashtags
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center bg-neutral-900 border border-neutral-800 rounded-md p-4 min-h-[280px]">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="AI-generated post" className="max-w-full max-h-[420px] rounded-md shadow-lg" />
            <a href={imageUrl} download="maroc-viral-auto-post.jpg" className="mt-3 text-sm text-maroc-red hover:underline">
              Download image
            </a>
          </>
        ) : (
          <p className="text-neutral-500 text-sm text-center">
            Photo + AI headline will appear here once generated.
          </p>
        )}
      </div>
    </div>
  );
}
