import { useState, useEffect } from 'react'
import {
  Monitor,
  Code2,
  Layers,
  LayoutDashboard,
  Plug,
  Sparkles,
} from 'lucide-react'
import { getApiErrorMessage, getServices } from '../api'

const ICON_MAP = { Monitor, Code2, Layers, LayoutDashboard, Plug, Sparkles }

function ServiceCard({ service }) {
  const Icon = ICON_MAP[service.icon] ?? Sparkles
  return (
    <article className="card card-hover p-6 flex flex-col gap-4">
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-orange-500" aria-hidden />
      </div>

      {/* Tag */}
      <div>
        <p className="text-[0.625rem] font-semibold tracking-widest uppercase text-orange-500 mb-1">
          {service.tag}
        </p>

        {/* Title */}
        <h2 className="text-base font-semibold text-white mb-2">
          {service.title}
        </h2>

        {/* Description */}
        <p className="text-[0.8125rem] text-zinc-500 leading-relaxed">
          {service.description}
        </p>
      </div>
    </article>
  )
}

export default function Services() {
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getServices()
      .then(({ data }) => {
        setServices(data)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(getApiErrorMessage(requestError, 'Please try again later.'))
        setStatus('error')
      })
  }, [])

  return (
    <main className="min-h-screen bg-[#0e0e10] pt-14">
      <div className="section-container py-20">

        {/* Header */}
        <div className="mb-14 max-w-2xl">
          <p className="section-label">What I offer</p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl leading-tight">
            Services
          </h1>
          <p className="mt-4 text-zinc-400 text-[0.9375rem] leading-7">
            I provide end-to-end web development services — from building clean
            interfaces to scalable backend systems — tailored to real-world needs.
          </p>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="card p-6 h-48 animate-pulse"
                aria-hidden="true"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 mb-4" />
                <div className="h-3 w-16 rounded bg-white/5 mb-3" />
                <div className="h-4 w-40 rounded bg-white/5 mb-2" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-6 py-10 text-center max-w-md">
            <p className="text-sm text-red-400 font-medium">Failed to load services</p>
            <p className="text-xs text-zinc-500 mt-1">{error}</p>
          </div>
        )}

        {/* Grid */}
        {status === 'ready' && services.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}

        {/* Empty */}
        {status === 'ready' && services.length === 0 && (
          <p className="text-sm text-zinc-500">No services found.</p>
        )}

      </div>
    </main>
  )
}
