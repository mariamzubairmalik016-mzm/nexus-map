import { Github, Instagram, Mail, Map, Twitter } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Footer = () => (
  <footer className="relative z-10 border-t border-white/10 bg-[#020617]">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
      <div className="md:col-span-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-400"><Map size={23} /></div>
          <h2 className="text-2xl font-bold">NEXUS MAP</h2>
        </div>
        <p className="mt-4 max-w-lg leading-7 text-slate-400">
          Intelligent worldwide navigation with GPS, offline maps, AI planning and community-powered local knowledge.
        </p>
        <div className="mt-6 flex gap-3">
          {[Github, Instagram, Twitter, Mail].map((Icon, index) => (
            <button key={index} className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-400 hover:text-cyan-300">
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Explore</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-400">
          <Link  href="/map" className="block hover:text-white">World Map</Link>
          <Link  href="/explore" className="block hover:text-white">Destinations</Link>
          <Link  href="/community" className="block hover:text-white">Community</Link>
          <Link  href="/offline-maps" className="block hover:text-white">Offline Maps</Link>
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Account</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-400">
          <Link  href="/dashboard" className="block hover:text-white">Dashboard</Link>
          <Link  href="/profile" className="block hover:text-white">Profile</Link>
          <Link  href="/settings" className="block hover:text-white">Settings</Link>
          <Link  href="/notifications" className="block hover:text-white">Notifications</Link>
        </div>
      </div>
    </div>
    <div className="border-t border-white/10 px-4 py-5 text-center text-sm text-slate-500">
      © 2026 NEXUS MAP. Frontend demonstration.
    </div>
  </footer>
);

export default Footer;
