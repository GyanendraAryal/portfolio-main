import { ArrowRight } from 'lucide-react'
import {
  Monitor,
  Code2,
  Layers,
  LayoutDashboard,
  Plug,
  Sparkles
} from 'lucide-react'

const iconMap = {
  Monitor,
  Code2,
  Layers,
  LayoutDashboard,
  Plug,
  Sparkles
}
const ServiceCard = ({ service }) => {
  const Icon = iconMap[service.icon]
  return (
    <div className="group relative overflow-hidden
      bg-[#0f1624] border border-[#1e2740] rounded-2xl p-6
      cursor-pointer transition-all duration-300 ease-out
      hover:-translate-y-1.5 hover:border-orange-500 hover:bg-[#111827]">

      {/* Ambient glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
        transition-opacity duration-300 pointer-events-none
        bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.07),transparent_60%)]" />

      {/* Icon badge */}
      <div className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center
        bg-orange-500/10 border border-orange-500/20
        group-hover:bg-orange-500/20 transition-colors duration-300">
        <Icon className="w-5 h-5 text-orange-400" />
      </div>

      {/* Category tag */}
      <p className="text-[10px] tracking-widest uppercase font-semibold
        text-orange-500 mb-2">
        {service.tag}
      </p>

      {/* Title */}
      <h2 className="text-base font-semibold text-slate-100 mb-2">
        {service.title}
      </h2>

      {/* Description */}
      <p className="text-slate-500 text-sm leading-relaxed mb-5">
        {service.desc}
      </p>

      {/* Reveal link */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-500
        opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
        transition-all duration-200">
        <span>Learn more</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
};

export default ServiceCard;