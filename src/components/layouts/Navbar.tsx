import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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

import { useAuth } from "../../hooks/useAuth";

const navigationLinks = [
  { label: "Home", path: "/" },
  { label: "Explore", path: "/explore" },
  { label: "Map", path: "/map" },
  { label: "Community", path: "/community" },
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const closeMenus = () => {
    setMobileOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    closeMenus();
  }, [location.pathname]);

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
      await signOut();
      toast.success("Logged out successfully.");
      navigate("/");
    } catch {
      toast.error("Logout failed.");
    }
  };

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] border-b border-white/[0.08] bg-[#020617]/78 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-3"
          onClick={closeMenus}
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.09)]">
            <Map size={24} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#020617] bg-emerald-400" />
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

        <nav className="hidden items-center rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1 lg:flex">
          {navigationLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative rounded-xl px-4 py-2.5 text-sm font-semibold ${
                isActive(item.path)
                  ? "bg-white/[0.075] text-white shadow-inner"
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
              to="/ai-planner"
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
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

        <div className="hidden items-center gap-3 lg:flex">
          {!user ? (
            <>
              <Link
                to="/login"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white"
              >
                Login
              </Link>

              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_12px_30px_rgba(14,165,233,0.18)] hover:-translate-y-0.5"
              >
                <Sparkles size={16} />
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/notifications"
                className="relative rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5 text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.06] hover:text-white"
              >
                <Bell size={19} />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#020617] bg-red-500 px-1 text-[9px] font-black text-white">
                  2
                </span>
              </Link>

              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="flex max-w-72 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 hover:border-cyan-400/20 hover:bg-white/[0.055]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/15 to-purple-400/15 text-cyan-300">
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-bold text-white">
                      {profile?.full_name || user.email}
                    </p>
                    <p className="text-[11px] capitalize text-slate-500">
                      {profile?.role || "user"} account
                    </p>
                  </div>

                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-500 transition ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-3 w-72 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#07101f]/96 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
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
                          to={path}
                          onClick={closeMenus}
                          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
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
                        to="/admin"
                        onClick={closeMenus}
                        className="mt-1 flex items-center gap-3 rounded-xl bg-purple-400/[0.07] px-4 py-3 text-sm font-semibold text-purple-200 hover:bg-purple-400/[0.12]"
                      >
                        <ShieldCheck size={17} />
                        Admin Control Center
                      </Link>
                    )}

                    <div className="my-2 h-px bg-white/[0.08]" />

                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-300 hover:bg-red-400/[0.08]"
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

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-2.5 text-white lg:hidden"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-[#020617]/98 px-4 py-4 shadow-2xl backdrop-blur-2xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {navigationLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMenus}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
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
                <div className="my-2 h-px bg-white/[0.08]" />

                {[{ path: "/ai-planner", label: "AI Planner" }, ...accountLinks].map(
                  (item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMenus}
                      className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.04]"
                    >
                      {item.label}
                    </Link>
                  ),
                )}

                {profile?.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={closeMenus}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-purple-300 hover:bg-purple-400/[0.08]"
                  >
                    Admin Panel
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-300 hover:bg-red-400/[0.08]"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={closeMenus}
                  className="rounded-xl border border-white/[0.09] px-4 py-3 text-center text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenus}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-center text-sm font-black text-slate-950"
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
