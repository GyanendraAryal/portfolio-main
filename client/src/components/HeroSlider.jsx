import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'

/* Inline SVGs — lucide-react@1.x doesn't include social brand icons */
const GitHubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 8 10.95c.6.1.82-.26.82-.58v-2.17c-3.26.71-3.95-1.57-3.95-1.57-.55-1.4-1.35-1.77-1.35-1.77-1.1-.75.08-.73.08-.73 1.22.09 1.86 1.25 1.86 1.25 1.08 1.86 2.84 1.32 3.53 1 .1-.79.42-1.32.76-1.62-2.6-.3-5.34-1.3-5.34-5.8 0-1.28.46-2.33 1.22-3.15-.12-.3-.53-1.52.12-3.16 0 0 1-.32 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.52 3.3-1.2 3.3-1.2.65 1.64.24 2.86.12 3.16.76.82 1.22 1.87 1.22 3.15 0 4.51-2.74 5.5-5.35 5.8.43.37.81 1.1.81 2.22v3.3c0 .32.22.69.83.57A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
  </svg>
)
const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4.98 3.5C4.98 4.88 3.86 6 2.48 6S0 4.88 0 3.5 1.12 1 2.48 1s2.5 1.12 2.5 2.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.16h.05c.53-1 1.84-2.16 3.8-2.16 4.07 0 4.82 2.68 4.82 6.16V24h-4v-7.1c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V24h-4V8z" />
  </svg>
)
import useTypingAnimation from '../hooks/useTypingAnimation'
import { getImages, getImageUrl } from '../api'
import usePortfolioProfile from '../context/usePortfolioProfile'

const SOCIAL_ITEMS = [
  { label: 'GitHub', urlKey: 'github_url', Icon: GitHubIcon },
  { label: 'LinkedIn', urlKey: 'linkedin_url', Icon: LinkedInIcon },
  { label: 'Instagram', urlKey: 'instagram_url', Icon: ExternalLink },
]

export default function HeroSlider() {
  const { profile, status: profileStatus, error: profileError } = usePortfolioProfile()
  const [slides, setSlides]       = useState([])
  const [idx, setIdx]             = useState(0)
  const [status, setStatus]       = useState('loading')
  const [failedImageUrl, setFailedImageUrl] = useState('')

  /* ── Fetch hero images ───────────────────────────── */
  useEffect(() => {
    let dead = false
    getImages('hero')
      .then((res) => {
        if (dead) return
        setSlides(res.data.filter(getImageUrl))
        setStatus('ready')
      })
      .catch(() => {
        if (!dead) setStatus('error')
      })
    return () => { dead = true }
  }, [])

  /* ── Auto-rotate slides ──────────────────────────── */
  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setIdx((p) => (p + 1) % slides.length), 4000)
    return () => clearInterval(t)
  }, [slides.length])

  const safeIdx    = slides.length ? Math.min(idx, slides.length - 1) : 0
  const activeSlide = slides[safeIdx] ?? null
  const imageSrc    = getImageUrl(activeSlide)
  const imgError = imageSrc === failedImageUrl
  const socialLinks = SOCIAL_ITEMS
    .map(({ urlKey, ...social }) => ({ ...social, href: profile?.[urlKey] }))
    .filter(({ href }) => href)

  /* ── Typing animation ────────────────────────────── */
  const typed = useTypingAnimation(profile?.hero_roles ?? [], {
    typingSpeed: 70,
    deletingSpeed: 45,
    pauseDelay: 2200,
  })

  /* ── Image block ─────────────────────────────────── */
  const imageBlock = useMemo(() => {
    const placeholder = (content) => (
      <div className="flex h-[300px] w-full max-w-[520px] items-center justify-center rounded-xl border border-white/8 bg-white/3 lg:h-[420px]">
        {content}
      </div>
    )

    if (status === 'loading') return placeholder(
      <p className="text-xs text-zinc-500 animate-pulse">Loading…</p>
    )

    if (!activeSlide || !imageSrc || imgError) return placeholder(
      <p className="text-xs text-zinc-500">
        {status === 'error' ? 'Hero images are temporarily unavailable' : imgError ? 'Image failed to load' : 'No hero images available'}
      </p>
    )

    return (
      <img
        key={`${safeIdx}-${imageSrc}`}
        src={imageSrc}
        alt={activeSlide.title || 'Hero'}
        className="h-auto w-full max-w-[520px] rounded-xl object-contain animate-fade-in drop-shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
        loading="eager"
        decoding="async"
        onError={() => setFailedImageUrl(imageSrc)}
      />
    )
  }, [status, activeSlide, imageSrc, safeIdx, imgError])

  return (
    <section
      aria-label="Hero — developer introduction"
      className="min-h-screen bg-[#0e0e10] flex flex-col justify-center pt-14"
    >
      <div className="section-container w-full">
        <div className="flex flex-col-reverse gap-12 items-center py-20 lg:flex-row lg:justify-between lg:gap-16 lg:py-28">

          {/* ── Text column ───────────────────────────── */}
          <div className="w-full max-w-2xl text-center lg:text-left lg:flex-1">

            {/* Label */}
            {profileStatus === 'ready' && (
              <p className="section-label mb-3 animate-fade-up">
                {profile.is_available ? 'Available for work' : 'Currently unavailable'}
              </p>
            )}

            {/* Headline */}
            <h1 className="text-4xl font-bold leading-[1.12] text-white sm:text-5xl lg:text-[3.5rem] animate-fade-up [animation-delay:80ms]">
              I build{' '}
              <br className="hidden sm:block" />
              <span className="text-orange-500 inline-flex items-baseline h-[1.15em] overflow-hidden">
                {typed}
                <span
                  className="ml-[1px] w-[2px] h-[0.9em] self-center bg-orange-500 animate-pulse inline-block"
                  aria-hidden="true"
                />
              </span>
            </h1>

            {/* Body */}
            {profileStatus === 'loading' ? (
              <div className="mt-6 h-16 w-full max-w-xl animate-pulse rounded bg-white/5" aria-label="Loading profile" />
            ) : (
              <p className="mt-6 text-[0.9375rem] leading-7 text-zinc-400 max-w-xl mx-auto lg:mx-0 animate-fade-up [animation-delay:160ms]">
                {profileStatus === 'error' ? profileError : profile?.hero_summary}
              </p>
            )}

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start animate-fade-up [animation-delay:240ms]">
              <Link to="/work" className="btn-primary">
                View my work <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/contact" className="btn-secondary">
                Contact me
              </Link>
            </div>

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="mt-8 flex justify-center gap-4 lg:justify-start animate-fade-up [animation-delay:320ms]">
                {socialLinks.map(({ label, href, Icon }, index) => (
                  <span key={label} className="contents">
                    {index > 0 && <span className="text-zinc-700" aria-hidden>·</span>}
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} profile`}
                      className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors"
                    >
                      <Icon /> {label}
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Image column ──────────────────────────── */}
          <div className="w-full lg:flex-1 flex justify-center lg:justify-end animate-fade-in [animation-delay:200ms]">
            <div className="relative">
              {/* Subtle orange glow behind image */}
              <div
                className="absolute -inset-6 rounded-2xl bg-orange-500/8 blur-2xl pointer-events-none"
                aria-hidden="true"
              />
              {imageBlock}

              {/* Slide dots */}
              {slides.length > 1 && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5" role="tablist" aria-label="Slide navigation">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={i === safeIdx}
                      onClick={() => setIdx(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === safeIdx ? 'w-5 bg-orange-500' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                      }`}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Subtle scroll indicator */}
      <div className="hidden lg:flex justify-center pb-8 animate-bounce" aria-hidden="true">
        <div className="w-5 h-8 rounded-full border border-zinc-700 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-zinc-600" />
        </div>
      </div>
    </section>
  )
}
