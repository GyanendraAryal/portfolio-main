import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Monitor, Code2, Layers, LayoutDashboard, Plug, Sparkles } from 'lucide-react'
import HeroSlider from '../components/HeroSlider'
import SkillsSection from '../components/SkillsSection'
import { getApiErrorMessage, getServices } from '../api'
import usePortfolioProfile from '../context/usePortfolioProfile'

/* ── Services preview — uses services.json like the Services page ─── */
const ICON_MAP = { Monitor, Code2, Layers, LayoutDashboard, Plug, Sparkles }

function ServicesPreview() {
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getServices()
      .then(({ data }) => {
        setServices(data.slice(0, 3))
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(getApiErrorMessage(requestError, 'Please try again later.'))
        setStatus('error')
      })
  }, [])

  return (
    <section aria-labelledby="services-preview-heading" className="bg-[#0a0a0c] py-24">
      <div className="section-container">

        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div>
            <p className="section-label">What I offer</p>
            <h2 id="services-preview-heading" className="text-3xl font-bold text-white sm:text-4xl">
              Services
            </h2>
          </div>
          <Link
            to="/service"
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-orange-400 transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {status === 'loading' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading services" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-40 animate-pulse p-5" aria-hidden="true">
                <div className="mb-4 h-9 w-9 rounded-lg bg-white/5" />
                <div className="mb-3 h-3 w-20 rounded bg-white/5" />
                <div className="mb-3 h-4 w-2/3 rounded bg-white/5" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-400" role="status">
            Could not load services: {error}
          </p>
        )}

        {status === 'ready' && services.length === 0 && (
          <p className="text-sm text-zinc-500">No services available.</p>
        )}

        {status === 'ready' && services.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = ICON_MAP[s.icon] ?? Sparkles
              return (
                <div key={s.id} className="card card-hover p-5 flex flex-col gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-orange-500" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[0.625rem] font-semibold tracking-widest uppercase text-orange-500 mb-1">{s.tag}</p>
                    <h3 className="text-sm font-semibold text-white mb-1">{s.title}</h3>
                    <p className="text-[0.8125rem] text-zinc-500 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </section>
  )
}

/* ── Contact CTA banner ──────────────────────────────────────────── */
function ContactCTA() {
  const { profile, status, error } = usePortfolioProfile()

  return (
    <section aria-labelledby="cta-heading" className="bg-[#0e0e10] py-24">
      <div className="section-container">
        <div className="rounded-xl border border-white/8 bg-[#141416] px-8 py-14 text-center max-w-2xl mx-auto">
          <p className="section-label mb-2">Let's work together</p>
          <h2 id="cta-heading" className="text-3xl font-bold text-white sm:text-4xl mb-4">
            Have a project in mind?
          </h2>
          {status === 'loading' ? (
            <div className="mx-auto mb-8 h-14 w-full max-w-lg animate-pulse rounded bg-white/5" aria-label="Loading profile" />
          ) : (
            <p className="text-zinc-400 text-[0.9375rem] leading-7 mb-8 max-w-lg mx-auto">
              {status === 'error' ? error : profile?.contact_summary}
            </p>
          )}
          <Link to="/contact" className="btn-primary inline-flex">
            Get in touch <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Home ────────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <>
      <HeroSlider />
      <SkillsSection />
      <ServicesPreview />
      <ContactCTA />
    </>
  )
}
