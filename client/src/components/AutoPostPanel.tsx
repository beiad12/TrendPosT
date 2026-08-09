import { useState } from "react";
import { api, AutoPostResult, Language, Provider, PROVIDER_LABELS, Trend } from "../lib/api.js";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "darija", label: "Darija" },
  { value: "french", label: "French" },
  { value: "msa", label: "MSA Arabic" },
];

const PROVIDERS: Provider[] = ["anthropic", "openai", "mistral", "google", "xai"];

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
 * AI in a single request.
 */
export default function AutoPostPanel({ trend }: { trend: Trend }) {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [language, setLanguage] = useState<Language>("french");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoPostResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const hasPhoto = Boolean(trend.imageUrl);

  async function handleGenerate() {
    if (!trend.imageUrl) {
      setError("This trend has no photo — pick a trend with one, or use the manual Templates flow.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.autoPost.generate({
        trend: {
          title: trend.title,
          sourceUrl: trend.url,
          source: trend.source,
          category: trend.category,
          imageUrl: trend.imageUrl,
        },
        provider,
        language,
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
        {!hasPhoto && (
          <p className="text-amber-400 text-sm bg-amber-950/40 border border-amber-800 rounded-md p-2.5">
            This trend has no photo captured from its source — auto post needs one. Try a different
            trend, or use the manual Templates flow with your own photo.
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

        <button
          onClick={handleGenerate}
          disabled={busy || !hasPhoto}
          className="w-full bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md py-2.5 font-medium"
        >
          {busy ? "Generating…" : "✨ Generate AI post (photo + headline)"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result && (
          <div className="space-y-2 text-sm">
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
