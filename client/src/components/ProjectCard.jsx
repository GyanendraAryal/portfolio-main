import { ArrowUpRight, GitBranch } from 'lucide-react'

const ProjectCard = ({ project, count }) => {
  return (
    <div className="group relative overflow-hidden
      bg-[#0f1624] border border-[#1e2740] rounded-2xl p-6
      cursor-pointer transition-all duration-300 ease-out
      hover:-translate-y-1.5 hover:border-orange-500 hover:bg-[#111827]">

      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
        transition-opacity duration-300 pointer-events-none
        bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.07),transparent_60%)]" />

      {/* Number badge */}
      <div className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center
        bg-orange-500/10 border border-orange-500/20
        group-hover:bg-orange-500/20 transition-colors duration-300">
        <span className="text-xs font-bold text-orange-400">
          {String(count).padStart(2, '0')}
        </span>
      </div>

      {/* Category tag */}
      <p className="text-[10px] tracking-widest uppercase font-semibold
        text-orange-500 mb-2">
        {project.tag}
      </p>

      {/* Title */}
      <h2 className="text-base font-semibold text-slate-100 mb-2">
        {project.title}
      </h2>

      {/* Description */}
      <p className="text-slate-500 text-sm leading-relaxed mb-4">
        {project.desc}
      </p>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {project.tech?.map((t) => (
          <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-md
            bg-[#1e2740] border border-[#1e2740] text-slate-500
            group-hover:text-slate-400 group-hover:border-[#2e3f60]
            transition-colors duration-200">
            {t}
          </span>
        ))}
      </div>

      {/* Reveal links */}
      <div className="flex items-center gap-3
        opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
        transition-all duration-200">
        {project.live && (
          <a href={project.live}
            className="flex items-center gap-1 text-xs font-medium text-orange-500
              px-2.5 py-1 rounded-lg border border-orange-500/25 bg-orange-500/7
              hover:bg-orange-500/15 transition-colors duration-200">
            Live <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
        {project.repo && (
          <a href={project.repo}
            className="flex items-center gap-1 text-xs font-medium text-slate-500
              px-2.5 py-1 rounded-lg border border-[#1e2740]
              hover:border-slate-600 hover:text-slate-400 transition-colors duration-200">
            Code <GitBranch className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

export default ProjectCard