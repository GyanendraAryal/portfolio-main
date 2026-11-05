import { useRef, useState } from 'react'
import { Mail, MapPin, Send, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { submitContact } from '../api'
import usePortfolioProfile from '../context/usePortfolioProfile'

/* Inline SVG social icons — lucide-react@1.x doesn't include brand icons */
const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 8 10.95c.6.1.82-.26.82-.58v-2.17c-3.26.71-3.95-1.57-3.95-1.57-.55-1.4-1.35-1.77-1.35-1.77-1.1-.75.08-.73.08-.73 1.22.09 1.86 1.25 1.86 1.25 1.08 1.86 2.84 1.32 3.53 1 .1-.79.42-1.32.76-1.62-2.6-.3-5.34-1.3-5.34-5.8 0-1.28.46-2.33 1.22-3.15-.12-.3-.53-1.52.12-3.16 0 0 1-.32 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.52 3.3-1.2 3.3-1.2.65 1.64.24 2.86.12 3.16.76.82 1.22 1.87 1.22 3.15 0 4.51-2.74 5.5-5.35 5.8.43.37.81 1.1.81 2.22v3.3c0 .32.22.69.83.57A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
  </svg>
)
const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4.98 3.5C4.98 4.88 3.86 6 2.48 6S0 4.88 0 3.5 1.12 1 2.48 1s2.5 1.12 2.5 2.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.16h.05c.53-1 1.84-2.16 3.8-2.16 4.07 0 4.82 2.68 4.82 6.16V24h-4v-7.1c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V24h-4V8z" />
  </svg>
)

const SOCIAL_ITEMS = [
  { label: 'GitHub', urlKey: 'github_url', icon: GitHubIcon },
  { label: 'LinkedIn', urlKey: 'linkedin_url', icon: LinkedInIcon },
  { label: 'Instagram', urlKey: 'instagram_url', icon: ExternalLink },
]

/* ── Reusable form field ──────────────────────────────────────── */
function Field({ label, id, children, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  )
}

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-colors duration-200'

export default function Contact() {
  const { profile, status: profileStatus, error: profileError } = usePortfolioProfile()
  const [form, setForm]     = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [errMsg, setErrMsg] = useState('')
  const formRef = useRef(null)
  const contactInfo = profile
    ? [
        { icon: Mail, label: 'Email', value: profile.contact_email, href: `mailto:${profile.contact_email}` },
        { icon: MapPin, label: 'Location', value: profile.location },
      ].filter(({ value }) => value)
    : []
  const socialLinks = SOCIAL_ITEMS
    .map(({ urlKey, ...social }) => ({ ...social, href: profile?.[urlKey] }))
    .filter(({ href }) => href)

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Name is required.'
    if (!form.email.trim())   e.email   = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address.'
    if (!form.message.trim()) e.message = 'Message is required.'
    else if (form.message.trim().length < 10)
      e.message = 'Message must be at least 10 characters.'
    return e
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    // Clear field error on change
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fieldErrors = validate()
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setStatus('loading')
    setErrMsg('')
    try {
      await submitContact(form)
      setStatus('success')
      setForm({ name: '', email: '', message: '' })
      setErrors({})
    } catch (err) {
      setStatus('error')
      const data = err.response?.data
      setErrMsg(
        data?.message?.[0] || data?.email?.[0] || data?.name?.[0] ||
        'Something went wrong. Please try again.'
      )
    }
  }

  const isSubmitting = status === 'loading'

  return (
    <main className="min-h-screen bg-[#0e0e10] pt-14">
      <div className="section-container py-20">

        {/* Header */}
        <div className="mb-14 max-w-2xl">
          <p className="section-label">Get in touch</p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl leading-tight">
            Let's build something together
          </h1>
          <p className="mt-4 text-zinc-400 text-[0.9375rem] leading-7">
            {profileStatus === 'loading' ? 'Loading contact details…' : profileStatus === 'error' ? profileError : profile?.contact_summary}
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-8 lg:grid-cols-5">

          {/* ── Left: contact info & socials ────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Info cards */}
            <div className="card p-5 flex flex-col gap-4">
              <p className="text-[0.6875rem] font-semibold tracking-widest uppercase text-zinc-600">
                Contact
              </p>
              {profileStatus === 'loading' && (
                <div className="space-y-3" aria-label="Loading contact details" aria-busy="true">
                  {[0, 1].map((item) => (
                    <div key={item} className="h-10 animate-pulse rounded bg-white/5" aria-hidden="true" />
                  ))}
                </div>
              )}
              {profileStatus === 'error' && <p className="text-sm text-red-400">{profileError}</p>}
              {contactInfo.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-orange-500" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600 mb-0.5">{label}</p>
                    {href ? (
                      <a href={href} className="text-sm text-zinc-200 hover:text-orange-400 transition-colors break-words">
                        {value}
                      </a>
                    ) : (
                      <p className="text-sm text-zinc-200">{value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Social links */}
            <div className="card p-5">
              <p className="text-[0.6875rem] font-semibold tracking-widest uppercase text-zinc-600 mb-4">
                Profiles
              </p>
              {profileStatus === 'loading' ? (
                <div className="space-y-2" aria-label="Loading profiles" aria-busy="true">
                  {[0, 1].map((item) => (
                    <div key={item} className="h-11 animate-pulse rounded-lg bg-white/5" aria-hidden="true" />
                  ))}
                </div>
              ) : profileStatus === 'ready' ? (
              <div className="flex flex-col gap-2">
                {socialLinks.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/8 text-zinc-400 hover:text-white hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-200"
                  >
                    <Icon className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm font-medium">{label}</span>
                  </a>
                ))}
              </div>
              ) : (
                <p className="text-sm text-red-400">{profileError}</p>
              )}
            </div>

          </div>

          {/* ── Right: form ─────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="card p-6 sm:p-8">

              {/* Success state */}
              {status === 'success' ? (
                <div className="flex flex-col items-center text-center py-10 gap-4">
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Message sent!</h2>
                    <p className="text-sm text-zinc-400 mt-1">Thanks for reaching out — I'll get back to you soon.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatus(null)}
                    className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                  <h2 className="text-base font-semibold text-white">Send a message</h2>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Name" id="name" error={errors.name}>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        autoComplete="name"
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        className={`${inputClass} ${errors.name ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20' : ''}`}
                      />
                    </Field>

                    <Field label="Email" id="email" error={errors.email}>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                        className={`${inputClass} ${errors.email ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20' : ''}`}
                      />
                    </Field>
                  </div>

                  <Field label="Message" id="message" error={errors.message}>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell me about your project or opportunity…"
                      aria-invalid={!!errors.message}
                      className={`${inputClass} resize-none ${errors.message ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20' : ''}`}
                    />
                  </Field>

                  {/* API error */}
                  {status === 'error' && (
                    <div
                      className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-400"
                      role="alert"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {errMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        Send message <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
