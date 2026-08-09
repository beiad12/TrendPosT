import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.js";
import Templates from "./pages/Templates.js";
import Settings from "./pages/Settings.js";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-maroc-red text-white" : "text-neutral-300 hover:bg-neutral-800"
  }`;

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🇲🇦</span>
            <span className="font-bold text-lg">Maroc Viral</span>
            <span className="text-neutral-500 text-sm hidden sm:inline">/ TrendPost</span>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/templates" className={navLinkClass}>
              Templates
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Settings
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <footer className="border-t border-neutral-800 text-center text-xs text-neutral-500 py-4">
        TrendPost — trend discovery, virality scoring, multi-AI captions & branded image rendering for Moroccan Facebook pages.
      </footer>
    </div>
  );
}
