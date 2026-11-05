import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import useTheme from "../hooks/useTheme";
import usePortfolioProfile from "../context/usePortfolioProfile";

const NAV_ITEMS = [
  { name: "Home", path: "/" },
  { name: "Services", path: "/service" },
  { name: "Work", path: "/work" },
  { name: "Resume", path: "/resume" },
  { name: "Contact", path: "/contact" },
];

export default function Navbar() {
  const { themeMode, toggleTheme } = useTheme();
  const { profile, status } = usePortfolioProfile();
  const darkMode = themeMode === "dark";

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Add shadow/border on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const desktopLink = ({ isActive }) =>
    `relative px-1 py-0.5 text-sm font-medium transition-colors duration-200 ${
      isActive ? "text-white" : "text-zinc-400 hover:text-white"
    }`;

  const mobileLink = ({ isActive }) =>
    `block w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
      isActive
        ? "text-white bg-orange-500/10 border-l-2 border-orange-500"
        : "text-zinc-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <>
      <nav
        className={`fixed top-0 inset-x-0 z-50 h-14 transition-all duration-300 ${
          scrolled
            ? "bg-[#0e0e10]/90 backdrop-blur-xl border-b border-white/8 shadow-[0_1px_0_rgba(255,255,255,0.05)]"
            : "bg-transparent"
        }`}
      >
        <div className="section-container h-full flex items-center justify-between gap-8">
          {/* Wordmark */}
          <Link
            to="/"
            className="flex items-baseline gap-0.5 shrink-0 focus-visible:outline-offset-4"
            aria-label="Portfolio home"
          >
            <span className="text-[1.1rem] font-bold tracking-tight text-white leading-none">
              {status === "loading" ? "…" : profile?.display_name}
            </span>
            <span className="text-orange-500 text-xl font-extrabold leading-none translate-y-px">
              .
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-7" role="list">
            {NAV_ITEMS.map((item) => (
              <li key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  className={desktopLink}
                >
                  {item.name}
                  {/* active indicator line */}
                  <span className="absolute -bottom-0.5 left-0 h-px w-full scale-x-0 bg-orange-500 origin-left transition-transform duration-200 group-has-[a[aria-current=page]]:scale-x-100" />
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Desktop Theme Toggle + CTA */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-pressed={darkMode}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={darkMode ? "Light mode" : "Dark mode"}
              className="p-2 cursor-pointer rounded-full text-gray-700 dark:text-gray-200
               hover:bg-gray-100 dark:hover:bg-gray-800
               transition-all duration-200"
            >
              {darkMode ? (
                <Sun size={20} className="text-orange-400" />
              ) : (
                <Moon size={20} className="text-slate-700" />
              )}
            </button>

            {/* Hire Me Button */}
            <Link
              to="/contact"
              className="px-4 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600
               text-white text-sm font-semibold
               transition-colors duration-200"
            >
              Hire me
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Open navigation menu"
            aria-expanded={open}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute top-0 right-0 h-full w-72 bg-[#141416] border-l border-white/8 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/8 shrink-0">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-baseline gap-0.5"
              >
                <span className="text-[1rem] font-bold text-white">
                  {status === "loading" ? "…" : profile?.display_name}
                </span>
                <span className="text-orange-500 text-lg font-extrabold">
                  .
                </span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={mobileLink}
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {/* Footer CTA */}
            <div className="px-4 py-5 border-t border-white/8">
              <button
                onClick={toggleTheme}
                aria-pressed={darkMode}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                {darkMode ? (
                  <Sun size={16} className="text-orange-400" aria-hidden />
                ) : (
                  <Moon size={16} className="text-slate-700" aria-hidden />
                )}
                Switch to {darkMode ? "light" : "dark"} mode
              </button>
              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="block w-full text-center px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
              >
                Hire me
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
