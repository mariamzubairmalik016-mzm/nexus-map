"use client";
import { Github, Instagram, Map, Send, Twitter } from "lucide-react";
import Link from "next/link";

const Footer = () => (
  <footer className="relative z-10 border-t border-white/[0.06] overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

    <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-4 lg:px-8">
      <div className="lg:col-span-2">
        <div className="flex items-center gap-3">
          <div className="rounded-[14px] bg-gradient-to-b from-[#3aa0ff] to-[#0a84ff] p-3 text-white shadow-[0_8px_20px_rgba(10,132,255,0.3),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Map size={23} />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-[-0.03em]">Nexus Map</p>
            <p className="text-[11px] font-medium text-white/45">Explore anywhere</p>
          </div>
        </div>
        <p className="mt-5 max-w-lg leading-7 text-slate-400">
          Intelligent worldwide navigation with GPS, offline maps, AI planning and community-powered local knowledge. Built for explorers, by explorers.
        </p>
        <div className="mt-8 flex gap-3">
          {[
            { Icon: Github, href: "https://github.com", label: "GitHub" },
            { Icon: Twitter, href: "https://twitter.com", label: "Twitter" },
            { Icon: Instagram, href: "https://instagram.com", label: "Instagram" },
            { Icon: Send, href: "https://t.me", label: "Telegram" },
          ].map(({ Icon, href, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Nexus Map on ${label}`}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-slate-400 transition-all duration-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.06] hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.06)]"
            >
              <Icon size={18} aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-white/50">Explore</h3>
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
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-white/50">Account</h3>
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
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-sm text-slate-400 sm:flex-row sm:text-left">
        <p>© 2026 Nexus Map. Frontend demonstration.</p>
        <p className="text-xs text-slate-500">Built with precision · Explore without limits</p>
      </div>
    </div>
  </footer>
);

export default Footer;
