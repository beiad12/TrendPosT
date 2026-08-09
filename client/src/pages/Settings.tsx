import { useEffect, useState } from "react";
import { api, Branding, BrandingPosition, Provider, PROVIDER_LABELS, ProviderStatus } from "../lib/api.js";

const PROVIDERS: Provider[] = ["anthropic", "openai", "mistral", "google", "xai"];

const POSITIONS: { value: BrandingPosition; label: string }[] = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

function BrandingPanel() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBranding(await api.branding.get());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setBranding(await api.branding.upload(file, branding?.position ?? "bottom-right"));
    } catch (err: any) {
      setError(err.message ?? "Failed to upload logo");
    } finally {
      setBusy(false);
    }
  }

  async function handlePosition(position: BrandingPosition) {
    setBusy(true);
    setError(null);
    try {
      setBranding(await api.branding.setPosition(position));
    } catch (err: any) {
      setError(err.message ?? "Failed to update position");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      setBranding(await api.branding.remove());
    } catch (err: any) {
      setError(err.message ?? "Failed to remove logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-md p-4 mb-8">
      <h2 className="font-medium mb-1">Page Logo</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Stamped automatically onto every rendered post — AI Auto Post and manual templates alike —
        no per-post setup required.
      </p>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="flex items-center gap-4 mb-4">
        <div className="w-20 h-20 rounded-md bg-neutral-950 border border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Page logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-500 text-center px-1">No logo yet</span>
          )}
        </div>
        <div className="flex gap-2">
          <label className="bg-maroc-red hover:bg-red-700 rounded-md px-3 py-1.5 text-sm cursor-pointer">
            {branding?.logoUrl ? "Replace logo" : "Upload logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={handleFile} />
          </label>
          {branding?.logoUrl && (
            <button
              onClick={handleRemove}
              disabled={busy}
              className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-md px-3 py-1.5 text-sm"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {branding?.logoUrl && (
        <div>
          <p className="text-xs text-neutral-400 mb-2">Position</p>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePosition(p.value)}
                disabled={busy}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  branding.position === p.value
                    ? "bg-maroc-red border-maroc-red"
                    : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [status, setStatus] = useState<ProviderStatus[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Provider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await api.settings.listKeys();
    setStatus(res.providers);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save(provider: Provider) {
    const key = inputs[provider]?.trim();
    if (!key) return;
    setBusy(provider);
    setMessage(null);
    try {
      await api.settings.setKey(provider, key);
      setInputs((s) => ({ ...s, [provider]: "" }));
      setMessage(`${PROVIDER_LABELS[provider]} key saved (encrypted).`);
      await refresh();
    } catch (e: any) {
      setMessage(e.message ?? "Failed to save key");
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: Provider) {
    setBusy(provider);
    try {
      await api.settings.deleteKey(provider);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <BrandingPanel />

      <h1 className="text-2xl font-bold mb-1">AI Provider Settings</h1>
      <p className="text-sm text-neutral-400 mb-6">
        Bring your own API key per provider. Keys are encrypted at rest (AES-256-GCM) and never
        logged or echoed back. A missing or invalid key simply disables that provider in the
        caption generator.
      </p>

      {message && <p className="text-sm text-maroc-red mb-4">{message}</p>}

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const s = status.find((x) => x.provider === p);
          return (
            <div key={p} className="bg-neutral-900 border border-neutral-800 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{PROVIDER_LABELS[p]}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    s?.configured
                      ? "text-green-400 border-green-700 bg-green-900/30"
                      : "text-neutral-400 border-neutral-700 bg-neutral-800"
                  }`}
                >
                  {s?.configured ? "Configured" : "Not configured"}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={s?.configured ? "•••••••••••• (replace key)" : "Paste API key"}
                  value={inputs[p] ?? ""}
                  onChange={(e) => setInputs((state) => ({ ...state, [p]: e.target.value }))}
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => save(p)}
                  disabled={busy === p || !inputs[p]}
                  className="bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md px-3 py-1.5 text-sm"
                >
                  Save
                </button>
                {s?.configured && (
                  <button
                    onClick={() => remove(p)}
                    disabled={busy === p}
                    className="bg-neutral-800 hover:bg-neutral-700 rounded-md px-3 py-1.5 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
