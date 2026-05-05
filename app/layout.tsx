"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const inter = Inter({ subsets: ["latin"] });

// =============================================================================
// NAV CONFIG
// =============================================================================
type NavLink = { href: string; label: string; icon: string; colors: string };

const PRIMARY_LINKS: NavLink[] = [
  { href: "/my-day", label: "My Day", icon: "🌅",
    colors: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400 border border-pink-200 dark:border-pink-500/30 hover:bg-pink-200 dark:hover:bg-pink-500/30" },
  { href: "/queue", label: "Queue", icon: "🔥",
    colors: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/30" },
  { href: "/quotes", label: "Quotes", icon: "📋",
    colors: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-200 dark:hover:bg-blue-500/30" },
  { href: "/jobs", label: "Jobs", icon: "🏭",
    colors: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-200 dark:hover:bg-orange-500/30" },
  { href: "/customers", label: "CRM", icon: "👥",
    colors: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 hover:bg-teal-200 dark:hover:bg-teal-500/30" },
];

const SECONDARY_GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Pipeline & Sales",
    links: [
      { href: "/prospector", label: "Prospector", icon: "🎯",
        colors: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-500/30 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-500/30" },
      { href: "/invoices", label: "Invoices", icon: "💰",
        colors: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30" },
    ],
  },
  {
    label: "Production",
    links: [
      { href: "/mockup-v2", label: "Mockup", icon: "🎨",
        colors: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 hover:bg-sky-200 dark:hover:bg-sky-500/30" },
      { href: "/purchasing", label: "Purchasing", icon: "📦",
        colors: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/30" },
      { href: "/print", label: "Print Center", icon: "🖨",
        colors: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/30" },
      { href: "/shop-floor", label: "Shop Floor", icon: "⚙️",
        colors: "bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-700 shadow-md" },
    ],
  },
  {
    label: "Tasks",
    links: [
      { href: "/todos", label: "To-Do List", icon: "✓",
        colors: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 hover:bg-purple-200 dark:hover:bg-purple-500/30" },
    ],
  },
];

// =============================================================================
// LAYOUT
// =============================================================================

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ── THEME ────────────────────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(true);

  const isMockupPage = pathname === "/mockup-creator" || pathname === "/mockup-v2";
  const isShopFloorPage = pathname === "/shop-floor";
  const isPortalPage = pathname?.startsWith("/portal") ?? false;

  useEffect(() => {
    const savedTheme = localStorage.getItem("yaya-theme");
    if (savedTheme === "light") setIsDarkMode(false);
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    const onThemeChange = () => {
      const t = localStorage.getItem("yaya-theme");
      setIsDarkMode(t !== "light");
    };
    window.addEventListener("themeChange", onThemeChange);
    return () => window.removeEventListener("themeChange", onThemeChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem("yaya-theme", newTheme ? "dark" : "light");
    window.dispatchEvent(new Event("themeChange"));
  };

  // ── MORE MENU — bulletproof: no animations, explicit z-index, simple state
  // The dropdown uses position:fixed so it escapes any parent overflow clipping
  // (the primary nav row uses overflow-x-auto which would otherwise hide it).
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreCoords, setMoreCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  // Measure the button's screen position so the dropdown anchors correctly
  const openMore = () => {
    if (moreBtnRef.current) {
      const rect = moreBtnRef.current.getBoundingClientRect();
      setMoreCoords({
        top: rect.bottom + 8,                              // 8px gap below button
        right: window.innerWidth - rect.right,             // align dropdown right edge with button right edge
      });
    }
    setMoreOpen(true);
  };

  // Close on outside click. The setTimeout(0) defers attaching the listener
  // until AFTER the click that opened the menu has finished bubbling.
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreWrapRef.current && !moreWrapRef.current.contains(target)) {
        setMoreOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [moreOpen]);

  // Close on Esc
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Auto-close on route change
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Reposition dropdown on window resize/scroll so it follows the button
  useEffect(() => {
    if (!moreOpen) return;
    const reposition = () => {
      if (moreBtnRef.current) {
        const rect = moreBtnRef.current.getBoundingClientRect();
        setMoreCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      }
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [moreOpen]);

  const btnBase = "px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm active:scale-95 flex items-center gap-1.5";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
  };

  const moreActive = SECONDARY_GROUPS.some(g => g.links.some(l => isActive(l.href)));

  return (
    <html lang="en" className={isDarkMode ? "dark" : ""}>
      <body className={`${inter.className} min-h-screen bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-slate-200 overflow-x-hidden transition-colors duration-300`}>

        {!isMockupPage && !isShopFloorPage && !isPortalPage && (
          <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 shadow-sm dark:shadow-md relative z-50 transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto flex items-center gap-2 w-full">

              <Link
                href="/"
                className={`${btnBase} bg-slate-800 text-white dark:bg-white dark:text-black hover:opacity-80 ${isActive("/") ? "ring-2 ring-sky-400 dark:ring-sky-500" : ""}`}
              >
                🏠 <span className="hidden sm:inline">Home</span>
              </Link>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" aria-hidden="true"></div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar items-center flex-1 min-w-0">
                {PRIMARY_LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${btnBase} ${link.colors} ${isActive(link.href) ? "ring-2 ring-sky-400 dark:ring-sky-500" : ""}`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}

                {/* MORE — relative wrapper, FIXED dropdown to escape overflow:hidden parents */}
                <div ref={moreWrapRef} className="relative shrink-0">
                  <button
                    ref={moreBtnRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (moreOpen) setMoreOpen(false);
                      else openMore();
                    }}
                    className={`${btnBase} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 ${moreActive ? "ring-2 ring-sky-400 dark:ring-sky-500" : ""}`}
                    aria-expanded={moreOpen}
                    aria-haspopup="true"
                  >
                    <span>More</span>
                    <span className="text-[8px]" style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
                  </button>

                  {moreOpen && (
                    <div
                      className="w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
                      style={{
                        position: "fixed",
                        top: moreCoords.top,
                        right: moreCoords.right,
                        zIndex: 9999,
                      }}
                    >
                      {SECONDARY_GROUPS.map((group, gIdx) => (
                        <div key={gIdx} className={gIdx > 0 ? "border-t border-slate-200 dark:border-slate-800" : ""}>
                          <div className="px-4 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            {group.label}
                          </div>
                          <div className="p-2 grid grid-cols-2 gap-1.5">
                            {group.links.map(link => (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMoreOpen(false)}
                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${link.colors} ${isActive(link.href) ? "ring-2 ring-sky-400 dark:ring-sky-500" : ""}`}
                              >
                                <span>{link.icon}</span>
                                <span className="truncate">{link.label}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  onClick={toggleTheme}
                  className="text-lg transition-transform hover:scale-110 flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Toggle theme"
                  aria-label="Toggle theme"
                >
                  {isDarkMode ? "☀️" : "🌙"}
                </button>
              </div>

            </div>
          </nav>
        )}

        <main>{children}</main>
      </body>
    </html>
  );
}
