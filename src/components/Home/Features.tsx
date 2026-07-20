import { Bot, Cloud, Globe2, MapPin, ShieldCheck, Users } from "lucide-react";

const items = [
  { title: "Global Maps", text: "Explore every country, city and place.", icon: Globe2 },
  { title: "AI Assistant", text: "Smart recommendations and intelligent search.", icon: Bot },
  { title: "GPS Tracking", text: "Real-time browser location support.", icon: MapPin },
  { title: "Offline Maps", text: "Prepare any region for offline access.", icon: Cloud },
  { title: "Secure Platform", text: "Protected accounts and private activity.", icon: ShieldCheck },
  { title: "Community", text: "Local alerts, reports and shared knowledge.", icon: Users },
];

const Features = () => (
  <section className="bg-[#020617] px-4 py-20 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[.28em] text-cyan-400">Everything in one platform</p>
        <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Powerful Features</h2>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map(({ title, text, icon: Icon }) => (
          <article key={title} className="rounded-[28px] border border-white/10 bg-white/[.04] p-6 backdrop-blur-2xl transition hover:-translate-y-1">
            <div className="inline-flex rounded-2xl bg-cyan-400/10 p-3 text-cyan-400"><Icon size={27} /></div>
            <h3 className="mt-5 text-xl font-bold">{title}</h3>
            <p className="mt-3 leading-6 text-slate-400">{text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
export default Features;
