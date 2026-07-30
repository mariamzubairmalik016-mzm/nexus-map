import { Globe2, Map, Search, Users } from "lucide-react";

import AnimatedCounter from "../ui/AnimatedCounter";
import Reveal from "../ui/Reveal";

const items = [
  { target: 195, suffix: "+", label: "Countries", icon: Globe2 },
  { target: 250, suffix: "K+", label: "Users", icon: Users },
  { target: 120, suffix: "M+", label: "Places", icon: Map },
  { target: 15, suffix: "M+", label: "AI Searches", icon: Search },
];

const Stats = () => (
  <section className="relative px-4 py-16 sm:px-6 lg:px-8">
    <div className="relative mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ target, suffix, label, icon: Icon }, index) => (
        <Reveal key={label} delay={index * 0.08}>
          <article className="nexus-card-elevated p-7">
            <div className="inline-flex rounded-2xl bg-gradient-to-br from-cyan-400/15 to-blue-600/10 p-3 text-cyan-400 shadow-[inset_0_1px_0_rgba(34,211,238,0.1)]">
              <Icon size={22} />
            </div>
            <p className="mt-5 text-4xl font-bold text-white">
              <AnimatedCounter target={target} suffix={suffix} />
            </p>
            <p className="mt-2 text-sm text-slate-400">{label}</p>
          </article>
        </Reveal>
      ))}
    </div>
  </section>
);

export default Stats;
