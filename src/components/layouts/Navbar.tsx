"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  ChevronDown,
  Download,
  Heart,
  History,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { useSession, signOut } from "next-auth/react";

const navigationLinks = [
  { label: "Home", path: "/" },
  { label: "Explore", path: "/explore" },
  { label: "Tourism", path: "/smart-tourism" },
  { label: "Map", path: "/map" },
  { label: "Alerts", path: "/road-alerts" },
  { label: "Safety", path: "/safety" },
  { label: "Community", path: "/community-hub" },
];

const accountLinks = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/profile", label: "My Profile", icon: UserRound },
  { path: "/favorites", label: "Favorites", icon: Heart },
  { path: "/history", label: "Route History", icon: History },
  { path: "/offline-maps", label: "Offline Maps", icon: Download },
  { path: "/settings", label: "Settings", icon: Settings },
];

const Navbar = () => {
  const pathname = usePathname();
  const navigate = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const profile = { full_name: user?.name, role: "user" };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const closeMenus = () => {
    setMobileOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    closeMenus();
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      toast.success("Logged out successfully.");
      navigate.push("/");
    } catch {
      toast.error("Logout failed.");
    }
  };

  const isActive = (path: string) =>
    path === "/"
      ? pathname === "/"
      : pathname.startsWith(path);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1000] transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-[#020617]/85 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      {/* Top decorative glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3"
          onClick={closeMenus}
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 to-blue-600/15 text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.09)] transition-all duration-300 group-hover:shadow-[0_0_40px_rgba(34,211,238,0.18)]">
            <Map size={24} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#020617] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
              NEXUS MAP
            </p>
            <p className="hidden text-[9px] font-bold uppercase tracking-[0.32em] text-cyan-400 sm:block">
              Explore anywhere
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1 lg:flex shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {navigationLinks.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`relative rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                isActive(item.path)
                  ? "bg-white/[0.07] text-white shadow-inner"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {item.label}
              {isActive(item.path) && (
                <span className="absolute inset-x-4 -bottom-1 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              )}
            </Link>
          ))}

          {user && (
            <Link
              href="/ai-planner"
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                isActive("/ai-planner")
                  ? "bg-purple-400/10 text-purple-200"
                  : "text-purple-300 hover:bg-purple-400/[0.08]"
              }`}
            >
              <Bot size={16} />
              AI Planner
            </Link>
          )}
        </nav>

        {/* Desktop right side */}
        <div className="hidden items-center gap-3 lg:flex">
          {!user ? (
            <>
              <Link
                href="/login"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all duration-300 hover:bg-white/[0.05] hover:text-white"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="nexus-button-primary px-5 py-2.5 text-sm"
              >
                <Sparkles size={16} />
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/notifications"
                className="relative rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 text-slate-300 transition-all duration-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.06] hover:text-white"
              >
                <Bell size={19} />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#020617] bg-red-500 px-1 text-[9px] font-black text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                  2
                </span>
              </Link>

              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="flex max-w-72 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 transition-all duration-300 hover:border-cyan-400/20 hover:bg-white/[0.055]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/15 to-purple-400/15 text-cyan-300">
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-bold text-white">
                      {profile?.full_name || user.email?.split("@")[0]}
                    </p>
                    <p className="text-[11px] capitalize text-slate-500">
                      {profile?.role || "user"} account
                    </p>
                  </div>

                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-500 transition-transform duration-300 ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {profileOpen && (
                  <div
                    className="nexus-fade-in absolute right-0 top-full mt-3 w-72 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#07101f]/95 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                  >
                    <div className="rounded-2xl bg-gradient-to-r from-cyan-400/[0.07] to-purple-400/[0.07] px-4 py-3">
                      <p className="truncate text-sm font-bold text-white">
                        {profile?.full_name || "Nexus Explorer"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {user.email}
                      </p>
                    </div>

                    <div className="mt-2">
                      {accountLinks.map(({ path, label, icon: Icon }) => (
                        <Link
                          key={path}
                          href={path}
                          onClick={closeMenus}
                          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            isActive(path)
                              ? "bg-cyan-400/[0.08] text-cyan-200"
                              : "text-slate-300 hover:bg-white/[0.045] hover:text-white"
                          }`}
                        >
                          <Icon size={17} />
                          {label}
                        </Link>
                      ))}
                    </div>

                    {profile?.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={closeMenus}
                        className="mt-1 flex items-center gap-3 rounded-xl bg-purple-400/[0.07] px-4 py-3 text-sm font-semibold text-purple-200 transition-all duration-200 hover:bg-purple-400/[0.12]"
                      >
                        <ShieldCheck size={17} />
                        Admin Control Center
                      </Link>
                    )}

                    <div className="my-2 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-300 transition-all duration-200 hover:bg-red-400/[0.08]"
                    >
                      <LogOut size={17} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-white transition-all duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.06] lg:hidden"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-[#020617]/98 px-4 py-4 shadow-2xl backdrop-blur-2xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {navigationLinks.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={closeMenus}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  isActive(item.path)
                    ? "bg-cyan-400/[0.08] text-cyan-200"
                    : "text-slate-300 hover:bg-white/[0.04]"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <>
                <div className="my-2 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                {[  { path: "/ai-planner", label: "AI Planner" },
                { path: "/smart-tourism", label: "Smart Tourism" },
                { path: "/safety", label: "Safety Center" },
                { path: "/community-hub", label: "Community Hub" }, ...accountLinks].map(
                  (item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={closeMenus}
                      className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 transition-all duration-200 hover:bg-white/[0.04]"
                    >
                      {item.label}
                    </Link>
                  ),
                )}

                {profile?.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={closeMenus}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-purple-300 transition-all duration-200 hover:bg-purple-400/[0.08]"
                  >
                    Admin Panel
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-300 transition-all duration-200 hover:bg-red-400/[0.08]"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={closeMenus}
                  className="rounded-xl border border-white/[0.08] px-4 py-3 text-center text-sm font-semibold transition-all duration-200 hover:border-white/20"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMenus}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-center text-sm font-black text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.15)]"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}

    </header>
  );
};

export default Navbar;
