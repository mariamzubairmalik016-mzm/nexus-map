import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, Bot, Compass, Download, Heart, History, LocateFixed, Map, MapPin, Navigation, Route, Settings, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useGeolocation } from "../../hooks/useGeolocation";

const quick = [
  ["/map", Map, "Open World Map", "Explore locations and plan live routes."],
  ["/ai-planner", Sparkles, "AI Trip Planner", "Generate a complete smart travel plan."],
  ["/offline-maps", Download, "Offline Maps", "Download any location for offline use."],
  ["/profile", UserRound, "My Profile", "Manage your personal account."],
  ["/favorites", Heart, "Favorites", "View your saved places."],
  ["/history", History, "Route History", "Review previous journeys."],
] as const;

const Dashboard = () => {
  const { user, profile } = useAuth();
  const geo = useGeolocation();
  const displayName = useMemo(() => profile?.full_name || user?.email?.split("@")[0] || "Nexus Explorer", [profile, user]);

  return (
    <section className="min-h-[calc(100vh-80px)] overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[30px] border border-white/10 bg-gradient-to-br from-cyan-500/[.08] via-slate-950/80 to-purple-600/[.08] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[.25em] text-cyan-400">Personal navigation workspace</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">Welcome back, <span className="block break-words text-gradient">{displayName}</span></h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">Explore the world, plan smarter journeys, download any map and manage your complete activity.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link to="/map" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950"><Compass size={18} />Explore World Map</Link><Link to="/ai-planner" className="inline-flex items-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-400/10 px-5 py-3 text-purple-200"><Bot size={18} />Plan with Nexus AI</Link></div>
        </motion.div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[[Heart, "Saved Places"], [Download, "Offline Maps"], [Navigation, "Saved Routes"], [Bot, "AI Searches"]].map(([Icon, label]) => (
            <article key={String(label)} className="min-h-40 rounded-[26px] border border-white/10 bg-white/[.04] p-5"><Icon className="text-cyan-400" /><p className="mt-6 text-3xl font-bold">0</p><p className="mt-2 text-sm text-slate-400">{String(label)}</p></article>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <article className="min-h-[400px] rounded-[30px] border border-white/10 bg-white/[.04] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-[.22em] text-cyan-400">Live location</p><h2 className="mt-1 text-2xl font-bold">GPS Navigation</h2></div><button onClick={geo.getCurrentLocation} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950"><LocateFixed size={18} />{geo.loading ? "Finding..." : "Get Current Location"}</button></div>
            {geo.coordinates ? <div className="mt-7 grid gap-4 sm:grid-cols-3">{[["Latitude", geo.coordinates.latitude], ["Longitude", geo.coordinates.longitude], ["Accuracy", geo.coordinates.accuracy ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-950/60 p-5"><p className="text-xs text-slate-500">{String(label)}</p><p className="mt-2 font-semibold">{Number(value).toFixed(String(label) === "Accuracy" ? 0 : 6)}</p></div>)}</div> : <div className="mt-7 flex min-h-52 items-center justify-center rounded-[24px] border border-dashed border-white/10"><div className="text-center"><MapPin className="mx-auto text-slate-600" size={40} /><p className="mt-4 font-semibold">Location not detected yet</p></div></div>}
          </article>

          <article className="min-h-[400px] rounded-[30px] border border-white/10 bg-white/[.04] p-6">
            <div className="flex items-center gap-4"><div className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-400"><UserRound /></div><div className="min-w-0"><p className="truncate text-xl font-bold">{displayName}</p><p className="truncate text-sm text-slate-400">{user?.email}</p></div></div>
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-300" /><div><p className="font-semibold text-emerald-200">Verified account</p><p className="text-xs text-emerald-200/60">Secure Nexus access enabled</p></div></div><span className="text-xs capitalize text-emerald-300">{profile?.role || "user"}</span></div>
            <div className="mt-6 grid grid-cols-2 gap-3">{[["/profile", UserRound, "Profile"], ["/settings", Settings, "Settings"], ["/notifications", Bell, "Notifications"], ["/history", Route, "History"]].map(([path, Icon, label]) => <Link key={String(path)} to={String(path)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><Icon size={17} />{String(label)}</Link>)}</div>
          </article>
        </div>

        <div className="mt-8"><h2 className="text-3xl font-bold">Quick Actions</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{quick.map(([path, Icon, title, description]) => <Link key={path} to={path} className="min-h-52 rounded-[26px] border border-white/10 bg-white/[.04] p-6 transition hover:-translate-y-1"><div className="inline-flex rounded-2xl bg-cyan-400/10 p-3 text-cyan-400"><Icon size={25} /></div><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 text-slate-400">{description}</p></Link>)}</div></div>
      </div>
    </section>
  );
};
export default Dashboard;
