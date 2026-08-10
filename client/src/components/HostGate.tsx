import { useState } from "react";
import { getApiHost, isNativeApp, resolveUrl, setApiHost } from "../lib/api.js";

/**
 * The packaged native app has no backend of its own — it's just the
 * bundled UI, and needs to be pointed at wherever the actual TrendPosT
 * server is running (same box, LAN, or a real domain). This gate blocks
 * the app on first launch until a host is entered and confirmed reachable
 * (GET /api/health), then remembers it (see api.ts#setApiHost) so this
 * only happens once. A no-op for the web/PWA build, which already has a
 * same-origin server and never renders this.
 */
export default function HostGate({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState(getApiHost());
  const [saved, setSaved] = useState(() => Boolean(getApiHost()));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isNativeApp || saved) return <>{children}</>;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = host.trim();
    if (!trimmed) {
      setError("Enter a server URL first.");
      return;
    }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`${normalized.replace(/\/+$/, "")}/api/health`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setApiHost(normalized);
      setSaved(true);
    } catch (err: any) {
      setError(
        `Couldn't reach that server (${err.message ?? "network error"}). Double-check the URL, that the server is ` +
          "running, and that this phone can reach it (same Wi-Fi for a LAN address)."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleConnect} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div className="text-3xl mb-2">🇲🇦</div>
        <h1 className="text-lg font-bold mb-1">Connect to your TrendPosT server</h1>
        <p className="text-sm text-neutral-400 mb-4">
          This app is just the interface — enter the address of the TrendPosT server it should talk to (e.g.{" "}
          <code className="text-neutral-300">https://trendpost.example.com</code> or{" "}
          <code className="text-neutral-300">http://192.168.1.20:4000</code> on your home network).
        </p>
        <input
          autoFocus
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="https://your-server.com"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm mb-3"
        />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md py-2.5 font-medium text-sm"
        >
          {checking ? "Connecting…" : "Connect"}
        </button>
        <p className="text-xs text-neutral-500 mt-3">
          A plain <code className="text-neutral-400">http://</code> LAN address only works if the server's network
          security config allows it (already the case for the default build).
        </p>
      </form>
    </div>
  );
}

/** Exported for the Settings page's "Server" panel so the host can be changed later, not just on first launch. */
export function ServerPanel() {
  const [host, setHostState] = useState(getApiHost());
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!isNativeApp) return null;

  async function handleSave() {
    const trimmed = host.trim();
    if (!trimmed) {
      setApiHost("");
      setStatus("idle");
      setMessage(null);
      return;
    }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    setChecking(true);
    setStatus("idle");
    try {
      const res = await fetch(`${normalized.replace(/\/+$/, "")}/api/health`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setApiHost(normalized);
      setHostState(normalized);
      setStatus("ok");
      setMessage("Connected.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message ?? "Couldn't reach that server.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-md p-4 mb-8">
      <h2 className="font-medium mb-1">Server</h2>
      <p className="text-sm text-neutral-400 mb-3">The address this app connects to. Currently: {resolveUrl("")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={host}
          onChange={(e) => setHostState(e.target.value)}
          placeholder="https://your-server.com"
          className="flex-1 bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={checking}
          className="bg-maroc-red hover:bg-red-700 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
        >
          {checking ? "Checking…" : "Save"}
        </button>
      </div>
      {message && <p className={`text-xs mt-2 ${status === "error" ? "text-red-400" : "text-emerald-400"}`}>{message}</p>}
    </div>
  );
}
