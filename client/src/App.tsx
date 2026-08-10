import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.js";
import DramaticStories from "./pages/DramaticStories.js";
import Templates from "./pages/Templates.js";
import Settings from "./pages/Settings.js";
import InstallButton from "./components/InstallButton.js";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap shrink-0 ${
    isActive ? "bg-maroc-red text-white" : "text-neutral-300 hover:bg-neutral-800"
  }`;

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* pt-safe: padding under the phone status bar in the packaged native app (edge-to-edge WebView) — a no-op on the web build, where env(safe-area-inset-*) is 0. */}
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🇲🇦</span>
            <span className="font-bold text-lg">Maroc Viral</span>
            <span className="text-neutral-500 text-sm hidden sm:inline">/ TrendPost</span>
          </div>
          {/* Horizontally scrollable on narrow phone widths instead of wrapping/overflowing — all four
              tabs + Install button never fit one row under ~420px, and wrapping looked broken. */}
          <nav className="flex gap-1 items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/dramatic-stories" className={navLinkClass}>
              🎬 Stories
            </NavLink>
            <NavLink to="/templates" className={navLinkClass}>
              Templates
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Settings
            </NavLink>
            <InstallButton />
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dramatic-stories" element={<DramaticStories />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <footer className="border-t border-neutral-800 text-center text-xs text-neutral-500 py-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        TrendPost — trend discovery, virality scoring, multi-AI captions & branded image rendering for Moroccan Facebook pages.
      </footer>
    </div>
  );
}
