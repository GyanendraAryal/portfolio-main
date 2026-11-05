import { useEffect, useState } from 'react'
import {
  Code2,
  Globe,
  Server,
  Container,
  BookOpen,
} from 'lucide-react'
import { getApiErrorMessage, getSkillCategories } from '../api'
import usePortfolioProfile from '../context/usePortfolioProfile'

const ICON_MAP = { Code2, Globe, Server, Container, BookOpen }

function CategoryCard({ category }) {
  const Icon = ICON_MAP[category.icon] ?? Code2

  return (
    <div className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:bg-white/[0.04] hover:shadow-[0_12px_35px_rgba(0,0,0,0.18)] sm:p-6">
      {/* Subtle top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 transition-all duration-300 group-hover:border-orange-500/35 group-hover:bg-orange-500/[0.15]">
          <Icon
            className="h-5 w-5 text-orange-500 transition-transform duration-300 group-hover:scale-110"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-wide text-white">
            {category.label}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {String(category.skills.length).padStart(2, '0')} skills
          </p>
        </div>
      </div>

      {/* Skill tags */}
      <ul className="flex flex-wrap gap-2" role="list">
        {category.skills.map((skill) => (
          <li
            key={skill.name}
            className="cursor-default rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-xs font-medium leading-relaxed text-zinc-400 transition-all duration-200 hover:border-orange-500/30 hover:bg-orange-500/[0.07] hover:text-zinc-200"
          >
            {skill.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function SkillsSection() {
  const { profile, status: profileStatus, error: profileError } = usePortfolioProfile()
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    getSkillCategories()
      .then(({ data }) => {
        setCategories(data)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(getApiErrorMessage(requestError, 'Please try again later.'))
        setStatus('error')
      })
  }, [])

  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="bg-[#0e0e10] py-24 sm:py-28"
    >
      <div className="section-container">
        {/* Section header */}
        <div className="mb-12 max-w-2xl sm:mb-14">
          <p className="section-label">Technical Skills</p>

          <h2
            id="skills-heading"
            className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl"
          >
            What I work with
            <span className="text-orange-500">.</span>
          </h2>

          {profileStatus === 'loading' ? (
            <div className="mt-5 h-14 w-full max-w-xl animate-pulse rounded bg-white/5" aria-label="Loading profile" />
          ) : (
            <p className="mt-5 max-w-xl text-[0.9375rem] leading-7 text-zinc-400">
              {profileStatus === 'error' ? profileError : profile?.hero_summary}
            </p>
          )}

          <div className="mt-6 h-px w-16 bg-orange-500/70" />
        </div>

        {/* Skills grid */}
        {status === 'loading' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Loading skills" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5" aria-hidden="true">
                <div className="mb-6 h-11 w-11 rounded-xl bg-white/5" />
                <div className="mb-3 h-4 w-2/3 rounded bg-white/5" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-400" role="status">
            Could not load skills: {error}
          </p>
        )}

        {status === 'ready' && categories.length === 0 && (
          <p className="text-sm text-zinc-500">No skills available.</p>
        )}

        {status === 'ready' && categories.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
