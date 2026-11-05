import { useState, useEffect } from 'react'
import { ArrowUpRight, GitBranch } from 'lucide-react'
import { getWorks } from '../api'

function ProjectCard({ project, index }) {
  const [imgError, setImgError] = useState(false)

  return (
    <article className="card card-hover group flex flex-col overflow-hidden h-full">
      {/* Image */}
      {project.image_url && !imgError ? (
        <div className="relative h-44 overflow-hidden bg-[#1a1a1c] shrink-0">
          <img
            src={project.image_url}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-44 bg-[#1a1a1c] border-b border-white/6 flex items-center justify-center shrink-0">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <span className="text-xs font-bold text-orange-400">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Tag */}
        <p className="text-[0.625rem] font-semibold tracking-widest uppercase text-orange-500">
          {project.tag}
        </p>

        {/* Title */}
        <h2 className="text-[0.9375rem] font-semibold text-white leading-snug">
          {project.title}
        </h2>

        {/* Description */}
        <p className="text-[0.8125rem] text-zinc-500 leading-relaxed flex-1">
          {project.description}
        </p>

        {/* Tech stack */}
        {project.tech_stack?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tech_stack.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-[0.6875rem] font-medium text-zinc-500 bg-white/[0.04] border border-white/6"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Links */}
        {(project.live_url || project.repo_url) && (
          <div className="flex items-center gap-2 pt-1">
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-orange-500 px-2.5 py-1 rounded-md border border-orange-500/25 bg-orange-500/6 hover:bg-orange-500/15 transition-colors"
              >
                Live <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 px-2.5 py-1 rounded-md border border-white/8 hover:border-white/20 hover:text-zinc-300 transition-colors"
              >
                Code <GitBranch className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export default function Work() {
  const [projects, setProjects] = useState([])
  const [status, setStatus]     = useState('loading')

  useEffect(() => {
    getWorks()
      .then(({ data }) => { setProjects(data); setStatus('ready') })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <main className="min-h-screen bg-[#0e0e10] pt-14">
      <div className="section-container py-20">

        {/* Header */}
        <div className="mb-14 max-w-2xl">
          <p className="section-label">Portfolio</p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl leading-tight">
            Featured Projects
          </h1>
          <p className="mt-4 text-zinc-400 text-[0.9375rem] leading-7">
            A selection of full-stack applications, responsive interfaces, and
            backend systems I've designed and built.
          </p>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading projects" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-72 animate-pulse p-5" aria-hidden="true">
                <div className="mb-5 h-32 rounded-lg bg-white/5" />
                <div className="mb-3 h-3 w-20 rounded bg-white/5" />
                <div className="mb-3 h-5 w-3/4 rounded bg-white/5" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-6 py-10 text-center max-w-md">
            <p className="text-sm text-red-400 font-medium">Failed to load projects</p>
            <p className="text-xs text-zinc-500 mt-1">Please try again later.</p>
          </div>
        )}

        {/* Empty */}
        {status === 'ready' && projects.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center max-w-md">
            <p className="text-sm text-zinc-400 font-medium">No projects yet</p>
            <p className="text-xs text-zinc-600 mt-1">Projects will appear here when added in the portfolio admin.</p>
          </div>
        )}

        {/* Grid */}
        {status === 'ready' && projects.length > 0 && (
          <div
            className={`grid gap-5 items-start ${
              projects.length === 1
                ? 'grid-cols-1 max-w-sm'
                : projects.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
