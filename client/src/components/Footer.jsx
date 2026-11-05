import { Link } from "react-router-dom";
import usePortfolioProfile from "../context/usePortfolioProfile";

const NAV_LINKS = [
  { name: "Home", path: "/" },
  { name: "Services", path: "/service" },
  { name: "Work", path: "/work" },
  { name: "Resume", path: "/resume" },
  { name: "Contact", path: "/contact" },
];

/* Inline SVG icons — no extra dependency needed */
const GitHubIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 8 10.95c.6.1.82-.26.82-.58v-2.17c-3.26.71-3.95-1.57-3.95-1.57-.55-1.4-1.35-1.77-1.35-1.77-1.1-.75.08-.73.08-.73 1.22.09 1.86 1.25 1.86 1.25 1.08 1.86 2.84 1.32 3.53 1 .1-.79.42-1.32.76-1.62-2.6-.3-5.34-1.3-5.34-5.8 0-1.28.46-2.33 1.22-3.15-.12-.3-.53-1.52.12-3.16 0 0 1-.32 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.52 3.3-1.2 3.3-1.2.65 1.64.24 2.86.12 3.16.76.82 1.22 1.87 1.22 3.15 0 4.51-2.74 5.5-5.35 5.8.43.37.81 1.1.81 2.22v3.3c0 .32.22.69.83.57A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M4.98 3.5C4.98 4.88 3.86 6 2.48 6S0 4.88 0 3.5 1.12 1 2.48 1s2.5 1.12 2.5 2.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.16h.05c.53-1 1.84-2.16 3.8-2.16 4.07 0 4.82 2.68 4.82 6.16V24h-4v-7.1c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V24h-4V8z" />
  </svg>
);

const InstagramIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M7.75 2C4.57 2 2 4.57 2 7.75v8.5C2 19.43 4.57 22 7.75 22h8.5C19.43 22 22 19.43 22 16.25v-8.5C22 4.57 19.43 2 16.25 2h-8.5zm0 2h8.5C18.33 4 20 5.67 20 7.75v8.5C20 18.33 18.33 20 16.25 20h-8.5C5.67 20 4 18.33 4 16.25v-8.5C4 5.67 5.67 4 7.75 4zm8.75 1.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
  </svg>
);

const SOCIAL_ITEMS = [
  {
    label: "GitHub",
    urlKey: "github_url",
    Icon: GitHubIcon,
  },
  {
    label: "LinkedIn",
    urlKey: "linkedin_url",
    Icon: LinkedInIcon,
  },
  {
    label: "Instagram",
    urlKey: "instagram_url",
    Icon: InstagramIcon,
  },
];

export default function Footer() {
  const { profile, status, error } = usePortfolioProfile();
  const socialLinks = SOCIAL_ITEMS.map(({ urlKey, ...social }) => ({
    ...social,
    href: profile?.[urlKey],
  })).filter((social) => social.href);

  return (
    <footer className="bg-[#0a0a0c] mt-12 border-t border-white/6">
      <div className="section-container py-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr] max-w-4xl">
          {/* Brand */}
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-0.5 mb-4 min-h-[1.5rem]"
            >
              <span className="text-lg font-bold text-white tracking-tight">
                {profile?.display_name}
              </span>
              <span className="text-orange-500 text-xl font-extrabold">.</span>
            </Link>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
              {status === "loading" ? (
                <span
                  className="block h-10 animate-pulse rounded bg-white/5"
                  aria-label="Loading profile"
                />
              ) : status === "error" ? (
                error
              ) : (
                profile?.footer_summary
              )}
            </p>
          </div>

          {/* Connect */}
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-widest uppercase text-zinc-400 mb-4">
              Connect
            </p>
            <div className="flex items-center gap-2 mb-4">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/8 text-zinc-500 hover:text-white hover:border-orange-500/40 hover:bg-orange-500/8 transition-all duration-200"
                >
                  <Icon />
                </a>
              ))}
            </div>
            {status === "ready" && (
              <p className="text-xs text-zinc-600 leading-relaxed">
                {profile?.contact_summary}
              </p>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} {profile?.display_name}. All rights
            reserved.
          </p>
          
        </div>
      </div>
    </footer>
  );
}
