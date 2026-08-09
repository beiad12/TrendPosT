import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install App" button — listens for the browser's beforeinstallprompt
 * event (fired only when the PWA installability criteria are met: served
 * over HTTPS/localhost, valid manifest, registered service worker, not
 * already installed) and triggers the native install prompt on click.
 * Renders nothing until the browser signals the app is installable, and
 * hides itself once installed.
 */
export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia?.("(display-mode: standalone)").matches ?? false
  );

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The prompt can only be used once; clear it either way.
    setDeferredPrompt(null);
  }

  return (
    <button
      onClick={handleInstall}
      className="px-3 py-2 rounded-md text-sm font-medium border border-neutral-700 text-neutral-200 hover:bg-neutral-800 flex items-center gap-1.5"
      title="Install Maroc Viral as an app"
    >
      <span aria-hidden>⬇</span> Install App
    </button>
  );
}
