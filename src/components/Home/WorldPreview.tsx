import { motion } from "framer-motion";
import { ArrowRight, Globe2, MapPin, Navigation } from "lucide-react";
import { Link } from "react-router-dom";

const points = [
  { name: "Karachi", className: "left-[24%] top-[58%]" },
  { name: "Dubai", className: "left-[42%] top-[52%]" },
  { name: "Tokyo", className: "left-[76%] top-[40%]" },
  { name: "Paris", className: "left-[34%] top-[30%]" },
];

const WorldPreview = () => (
  <section className="bg-[#020617] px-4 py-20 sm:px-6 lg:px-8">
    <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300"><Globe2 size={17} />Worldwide coverage</div>
        <h2 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">One map for your <span className="text-gradient">entire world</span></h2>
        <p className="mt-5 max-w-xl leading-7 text-slate-400">Search cities, landmarks, hospitals, hotels and services across Pakistan and worldwide.</p>
        <Link to="/map" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-6 py-3.5 font-semibold text-slate-950">Open interactive map <ArrowRight size={18} /></Link>
      </div>
      <motion.div initial={{ opacity: 0, scale: .94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative min-h-[430px] overflow-hidden rounded-[34px] border border-white/10 bg-gradient-to-br from-cyan-500/[.08] via-slate-950 to-purple-600/[.08] shadow-2xl">
        <div className="absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/20 bg-cyan-400/[.04]" />
        <div className="absolute left-1/2 top-1/2 h-[235px] w-[235px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-400/20" />
        {points.map((point, index) => (
          <motion.div key={point.name} animate={{ y: [0, -8, 0] }} transition={{ duration: 3 + index * .35, repeat: Infinity }} className={`absolute ${point.className}`}>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 text-xs"><MapPin size={15} className="text-cyan-400" />{point.name}</div>
          </motion.div>
        ))}
        <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/75 p-4">
          <div><p className="text-xs uppercase tracking-[.2em] text-cyan-400">Live map preview</p><p className="mt-1 text-sm text-slate-300">Explore 195+ countries</p></div>
          <Navigation className="text-cyan-400" />
        </div>
      </motion.div>
    </div>
  </section>
);
export default WorldPreview;
