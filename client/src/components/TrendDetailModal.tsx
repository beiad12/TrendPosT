import { useState } from "react";
import {
  api,
  CaptionVariant,
  Language,
  Provider,
  PROVIDER_LABELS,
  Trend,
} from "../lib/api.js";
import RenderPanel from "./RenderPanel.js";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "darija", label: "Darija" },
  { value: "french", label: "French" },
  { value: "msa", label: "MSA Arabic" },
];

const PROVIDERS: Provider[] = ["anthropic", "openai", "mistral", "google", "xai"];

export default function TrendDetailModal({ trend, onClose }: { trend: Trend; onClose: () => void }) {
  const [language, setLanguage] = useState<Language>("french");
  const [provider, setProvider] = useState<Provider | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variantsByProvider, setVariantsByProvider] = useState<
    Record<string, { variants: CaptionVariant[]; suggestedPostTime?: string } | { error: string }>
  >({});
  const [chosenHeadline, setChosenHeadline] = useState<string>(trend.title);
  const [chosenDescription, setChosenDescription] = useState<string>("");
  const [step, setStep] = useState<"caption" | "render">("caption");

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setVariantsByProvider({});
    try {
      const res = await api.ai.generate({
        provider: provider === "all" ? undefined : provider,
        language,
        trend: {
          title: trend.title,
          sourceUrl: trend.url,
          source: trend.source,
          category: trend.category,
        },
      });
      const next: typeof variantsByProvider = {};
      for (const entry of res.results) {
        if (entry.ok && entry.result) {
          next[entry.provider] = {
            variants: entry.result.variants,
            suggestedPostTime: entry.result.suggestedPostTime,
          };
        } else {
          next[entry.provider] =
            entry.error === "missing_api_key"
              ? { error: "Add your API key in Settings to use this provider." }
              : { error: entry.error ?? "Generation failed." };
        }
      }
      setVariantsByProvider(next);
    } catch (e: any) {
      setError(e.message ?? "Failed to generate captions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto py-8 z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-3xl w-full mx-4 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold">{trend.title}</h2>
            <p className="text-sm text-neutral-400">
              {trend.source} · {trend.category} ·{" "}
              <a href={trend.url} target="_blank" rel="noreferrer" className="underline">
                source
              </a>
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1.5 rounded-md text-sm ${step === "caption" ? "bg-maroc-red" : "bg-neutral-800"}`}
            onClick={() => setStep("caption")}
          >
            1 · Generate caption
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm ${step === "render" ? "bg-maroc-red" : "bg-neutral-800"}`}
            onClick={() => setStep("render")}
          >
            2 · Render image
          </button>
        </div>

        {step === "caption" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select
                className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm"
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider | "all")}
              >
                <option value="all">Compare All</option>
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
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md px-4 py-1.5 text-sm font-medium"
              >
                {busy ? "Generating…" : "Generate captions"}
              </button>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {Object.entries(variantsByProvider).map(([p, data]) => (
                <div key={p} className="border border-neutral-800 rounded-md p-3">
                  <p className="text-sm font-semibold mb-2">{PROVIDER_LABELS[p as Provider]}</p>
                  {"error" in data ? (
                    <p className="text-amber-400 text-sm">{data.error}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.suggestedPostTime && (
                        <p className="text-xs text-neutral-400">⏰ {data.suggestedPostTime}</p>
                      )}
                      {data.variants.map((v, i) => (
                        <div key={i} className="bg-neutral-800/60 rounded-md p-2.5">
                          <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">{v.tone}</p>
                          <p className="text-sm whitespace-pre-wrap">{v.caption}</p>
                          <p className="text-xs text-maroc-red mt-1">{v.hashtags.join(" ")}</p>
                          <button
                            className="mt-2 text-xs underline text-neutral-400 hover:text-white"
                            onClick={() => {
                              navigator.clipboard.writeText(`${v.caption}\n\n${v.hashtags.join(" ")}`);
                            }}
                          >
                            Copy caption + hashtags
                          </button>
                          <button
                            className="mt-2 ml-3 text-xs underline text-neutral-400 hover:text-white"
                            onClick={() => {
                              const sentences = v.caption.split(/(?<=[.!?])\s+/).filter(Boolean);
                              setChosenHeadline((sentences[0] ?? v.caption).slice(0, 90));
                              setChosenDescription(sentences.slice(1).join(" ").slice(0, 220));
                              setStep("render");
                            }}
                          >
                            Use as headline →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "render" && (
          <RenderPanel
            initialHeadline={chosenHeadline}
            initialDescription={chosenDescription}
            initialPhotoUrl={trend.imageUrl ?? ""}
            initialCategory={trend.category}
          />
        )}
      </div>
    </div>
  );
}
