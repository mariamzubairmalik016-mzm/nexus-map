import { Globe2, Map, Search, Users } from "lucide-react";

const items = [
  { value: "195+", label: "Countries", icon: Globe2 },
  { value: "250K+", label: "Users", icon: Users },
  { value: "120M+", label: "Places", icon: Map },
  { value: "15M+", label: "AI Searches", icon: Search },
];

const Stats = () => (
  <section className="bg-[#020617] px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ value, label, icon: Icon }) => (
        <article key={label} className="rounded-[26px] border border-white/10 bg-white/[.04] p-6">
          <Icon className="text-cyan-400" />
          <p className="mt-5 text-4xl font-bold">{value}</p>
          <p className="mt-2 text-slate-400">{label}</p>
        </article>
      ))}
    </div>
  </section>
);
export default Stats;
