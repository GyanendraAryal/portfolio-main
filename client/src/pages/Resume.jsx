import { useEffect, useState } from 'react'
import { Download, ExternalLink, Loader2 } from 'lucide-react'
import {
  getActiveResume,
  getApiErrorMessage,
  getSkillCategories,
  getWorks,
} from '../api'
import usePortfolioProfile from '../context/usePortfolioProfile'

export default function Resume() {
  const { profile, status: profileStatus, error: profileError } = usePortfolioProfile()
  const [resumeUrl, setResumeUrl] = useState('')
  const [loadingResume, setLoadingResume] = useState(true)
  const [resumeError, setResumeError] = useState('')
  const [skills, setSkills] = useState([])
  const [skillsStatus, setSkillsStatus] = useState('loading')
  const [skillsError, setSkillsError] = useState('')
  const [projects, setProjects] = useState([])
  const [projectsStatus, setProjectsStatus] = useState('loading')
  const [projectsError, setProjectsError] = useState('')

  useEffect(() => {
    getActiveResume()
      .then((res) => {
        if (res.data?.file_url) setResumeUrl(res.data.file_url)
      })
      .catch((requestError) => {
        setResumeError(getApiErrorMessage(requestError, 'Could not load the resume.'))
      })
      .finally(() => setLoadingResume(false))
  }, [])

  useEffect(() => {
    getSkillCategories()
      .then(({ data }) => {
        setSkills([...new Set(data.flatMap((category) => category.skills.map((skill) => skill.name)))])
        setSkillsStatus('ready')
      })
      .catch((requestError) => {
        setSkillsError(getApiErrorMessage(requestError, 'Please try again later.'))
        setSkillsStatus('error')
      })
  }, [])

  useEffect(() => {
    getWorks()
      .then(({ data }) => {
        setProjects(data)
        setProjectsStatus('ready')
      })
      .catch((requestError) => {
        setProjectsError(getApiErrorMessage(requestError, 'Please try again later.'))
        setProjectsStatus('error')
      })
  }, [])

  return (
    <main className="min-h-screen bg-[#09090b] pt-14 text-zinc-100">
      <div className="section-container py-20 max-w-3xl">

        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
          <div>
            {profileStatus === 'ready' && (
              <p className="section-label mb-3">
                {profile.is_available ? 'Available for work' : 'Currently unavailable'}
              </p>
            )}
            <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl">
              Full-Stack
              <br />
              <span className="text-orange-500">Developer</span>
            </h1>
            {profileStatus === 'loading' ? (
              <div className="mt-4 h-16 w-full max-w-md animate-pulse rounded bg-white/5" aria-label="Loading profile" />
            ) : (
              <p className="mt-4 text-[0.9375rem] text-zinc-400 leading-relaxed max-w-md">
                {profileStatus === 'error' ? profileError : profile?.resume_summary}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {loadingResume ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : resumeError ? (
              <p className="text-sm text-red-400">{resumeError}</p>
            ) : (
              resumeUrl ? (
                <>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  aria-label="Download resume PDF"
                >
                  <Download className="w-4 h-4" />
                  Download CV
                </a>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View PDF
                </a>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Resume is not available right now.</p>
              )
            )}
          </div>
        </div>

        {/* ── Divider ────────────────────────────────────── */}
        <div className="h-px bg-gradient-to-r from-zinc-900 via-zinc-700/60 to-zinc-900 mb-14" />

        {/* ── Skills ─────────────────────────────────────── */}
        <section aria-labelledby="resume-skills" className="mb-14">
          <p className="text-[0.6875rem] tracking-widest uppercase text-zinc-600 font-semibold mb-5" id="resume-skills">
            Skills
          </p>
          {skillsStatus === 'loading' && (
            <div className="flex flex-wrap gap-2" aria-label="Loading skills" aria-busy="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="h-8 w-20 animate-pulse rounded-md bg-white/5" aria-hidden="true" />
              ))}
            </div>
          )}
          {skillsStatus === 'error' && <p className="text-sm text-red-400">{skillsError}</p>}
          {skillsStatus === 'ready' && skills.length === 0 && (
            <p className="text-sm text-zinc-500">No skills available.</p>
          )}
          {skillsStatus === 'ready' && skills.length > 0 && (
            <div className="flex flex-wrap gap-2" role="list">
              {skills.map((s) => (
                <span
                  key={s}
                  role="listitem"
                  className="px-3 py-1.5 rounded-md border border-zinc-800 bg-[#111113] text-zinc-400 text-[0.8125rem] hover:border-orange-500/50 hover:text-zinc-200 transition-colors cursor-default"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Projects ───────────────────────────────────── */}
        <section aria-labelledby="resume-projects">
          <p className="text-[0.6875rem] tracking-widest uppercase text-zinc-600 font-semibold mb-5" id="resume-projects">
            Projects
          </p>
          {projectsStatus === 'loading' && (
            <div className="flex flex-col gap-3" aria-label="Loading projects" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-5" aria-hidden="true">
                  <div className="mb-3 h-4 w-1/3 rounded bg-white/5" />
                  <div className="mb-3 h-3 w-full rounded bg-white/5" />
                  <div className="h-3 w-1/2 rounded bg-white/5" />
                </div>
              ))}
            </div>
          )}
          {projectsStatus === 'error' && <p className="text-sm text-red-400">{projectsError}</p>}
          {projectsStatus === 'ready' && projects.length === 0 && (
            <p className="text-sm text-zinc-500">No projects available.</p>
          )}
          {projectsStatus === 'ready' && projects.length > 0 && (
            <div className="flex flex-col gap-3">
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-4 p-5 rounded-xl border border-zinc-900 bg-[#111113] hover:border-zinc-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-100 mb-1">{p.title}</h3>
                    <p className="text-[0.8125rem] text-zinc-500 leading-relaxed mb-2">{p.description}</p>
                    {(p.tech_stack ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.tech_stack.map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[0.6875rem] text-zinc-600 bg-zinc-900/80 border border-zinc-800">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[0.6875rem] text-zinc-700 font-medium pt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Footer note ────────────────────────────────── */}
        <div className="mt-14 pt-6 border-t border-zinc-900 flex items-center justify-between">
          <p className="text-xs text-zinc-700 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
            {skills.slice(0, 5).join(' · ')}
          </p>
          <p className="text-xs text-zinc-700">{new Date().getFullYear()}</p>
        </div>

      </div>
    </main>
  )
}
