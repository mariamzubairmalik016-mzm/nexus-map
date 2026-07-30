import { Bot, Cloud, Globe2, MapPin, ShieldCheck, Users } from "lucide-react";

const items = [
  { title: "Global Maps", text: "Explore every country, city and place with seamless navigation.", icon: Globe2 },
  { title: "AI Assistant", text: "Smart recommendations and intelligent search powered by Nexus AI.", icon: Bot },
  { title: "GPS Tracking", text: "Real-time browser location support with high accuracy.", icon: MapPin },
  { title: "Offline Maps", text: "Prepare any region for offline access — no signal required.", icon: Cloud },
  { title: "Secure Platform", text: "Protected accounts and private activity with enterprise-grade security.", icon: ShieldCheck },
  { title: "Community", text: "Local alerts, reports and shared knowledge from fellow explorers.", icon: Users },
];

const Features = () => (
  <section className="relative px-4 py-24 sm:px-6 lg:px-8">
    {/* Section header glow */}
    <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_60%_80%_at_50%_-20%,rgba(34,211,238,0.06),transparent)]" />

    <div className="relative mx-auto max-w-7xl">
      <div className="text-center">
        <p className="nexus-eyebrow">Everything in one platform</p>
        <h2 className="text-hero-display mt-4 text-[2rem] sm:text-5xl md:text-6xl">
          Powerful <span className="nexus-gradient-text">Features</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">
          Everything you need to explore the world, from AI-powered planning to offline navigation.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map(({ title, text, icon: Icon }) => (
          <article
            key={title}
            className="nexus-card-elevated p-7"
          >
            <div className="inline-flex rounded-2xl bg-gradient-to-br from-cyan-400/15 to-blue-600/10 p-3.5 text-cyan-400 shadow-[inset_0_1px_0_rgba(34,211,238,0.1)]">
              <Icon size={27} />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white">{title}</h3>
            <p className="mt-3 leading-7 text-slate-400">{text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
