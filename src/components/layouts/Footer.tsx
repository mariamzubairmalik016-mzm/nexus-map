"use client";
import { Github, Instagram, Map, Send, Twitter } from "lucide-react";
import Link from "next/link";

const Footer = () => (
  <footer className="relative z-10 border-t border-white/[0.06] bg-[#020617] overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

    <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-4 lg:px-8">
      <div className="lg:col-span-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-cyan-400/15 to-blue-600/15 p-3 text-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
            <Map size={23} />
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight">NEXUS MAP</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-cyan-400">Explore anywhere</p>
          </div>
        </div>
        <p className="mt-5 max-w-lg leading-7 text-slate-400">
          Intelligent worldwide navigation with GPS, offline maps, AI planning and community-powered local knowledge. Built for explorers, by explorers.
        </p>
        <div className="mt-8 flex gap-3">
          {[
            { Icon: Github, href: "#" },
            { Icon: Twitter, href: "#" },
            { Icon: Instagram, href: "#" },
            { Icon: Send, href: "#" },
          ].map(({ Icon, href }, index) => (
            <a
              key={index}
              href={href}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-slate-400 transition-all duration-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.06] hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.06)]"
            >
              <Icon size={18} />
            </a>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Explore</h3>
        <div className="mt-5 space-y-3">
          {[
            { label: "World Map", href: "/map" },
            { label: "Destinations", href: "/explore" },
            { label: "Community", href: "/community" },
            { label: "Offline Maps", href: "/offline-maps" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="block text-sm text-slate-400 transition-all duration-200 hover:text-white hover:translate-x-1"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Account</h3>
        <div className="mt-5 space-y-3">
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Profile", href: "/profile" },
            { label: "Settings", href: "/settings" },
            { label: "Notifications", href: "/notifications" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="block text-sm text-slate-400 transition-all duration-200 hover:text-white hover:translate-x-1"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>

    <div className="relative border-t border-white/[0.06] px-4 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-sm text-slate-500 sm:flex-row sm:text-left">
        <p>© 2026 NEXUS MAP. Frontend demonstration.</p>
        <p className="text-xs text-slate-600">Built with precision · Explore without limits</p>
      </div>
    </div>
  </footer>
);

export default Footer;
