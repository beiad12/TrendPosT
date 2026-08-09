import { useEffect, useState } from "react";
import { api, Provider, PROVIDER_LABELS, ProviderStatus } from "../lib/api.js";

const PROVIDERS: Provider[] = ["anthropic", "openai", "mistral", "google", "xai"];

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
