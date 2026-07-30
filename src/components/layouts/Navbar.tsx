"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { unreadCount as getUnreadCount, subscribe } from "../../services/notificationsService";
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
  const profile = { full_name: user?.name, role: (user as any)?.role || "user" };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  // Real unread count, read from the notification store and kept live via its
  // subscription (this fires for same-tab changes too, which the native
  // `storage` event does not). Starts at 0 so server and first client render
  // agree — reading localStorage during render would hydrate-mismatch.
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const sync = () => setUnreadCount(getUnreadCount());
    sync();
    return subscribe(sync);
  }, []);

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

  // Keyboard: Escape closes any open menu. When the profile menu closes this
  // way, return focus to its trigger so keyboard users are not stranded.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (profileOpen) {
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
      setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [profileOpen]);

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
          ? "border-b border-white/[0.12] bg-white/[0.06] shadow-[0_16px_50px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-3xl backdrop-saturate-[2.2]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3"
          onClick={closeMenus}
        >
          {/* App-icon squircle: the iOS 26 continuous-corner tile, tinted systemBlue */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#3aa0ff] to-[#0a84ff] text-white shadow-[0_8px_20px_rgba(10,132,255,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-300 group-hover:shadow-[0_10px_28px_rgba(10,132,255,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]">
            <Map size={23} strokeWidth={2.2} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#060709] bg-emerald-400" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[1.35rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.5rem]">
              Nexus Map
            </p>
            <p className="hidden text-[10px] font-medium tracking-[0.02em] text-white/45 sm:block">
              Explore anywhere
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        {/* Segmented-control nav: a glass track with a raised pill on the
            active item, the way iOS marks selection. */}
        <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.10] bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl backdrop-saturate-[1.8] lg:flex">
          {navigationLinks.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive(item.path) ? "page" : undefined}
              className={`relative rounded-full px-4 py-2 text-[0.8125rem] font-medium tracking-[-0.01em] transition-all duration-300 ${
                isActive(item.path)
                  ? "bg-white/[0.16] text-white shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-white/55 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {user && (
            <Link
              href="/ai-planner"
              aria-current={isActive("/ai-planner") ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.8125rem] font-medium tracking-[-0.01em] transition-all duration-300 ${
                isActive("/ai-planner")
                  ? "bg-purple-400/20 text-purple-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                  : "text-purple-300 hover:bg-purple-400/[0.12]"
              }`}
            >
              <Bot size={15} />
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
                className="rounded-full px-4 py-2.5 text-sm font-medium text-white/70 transition-all duration-300 hover:bg-white/[0.07] hover:text-white"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="nexus-button-primary nexus-button-sm"
              >
                <Sparkles size={16} />
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/notifications"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : "Notifications"
                }
                className="relative rounded-full border border-white/[0.10] bg-white/[0.05] p-2.5 text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/[0.10] hover:text-white"
              >
                <Bell size={19} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0c0d11] bg-[#ff453a] px-1 text-[10px] font-semibold text-white"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <div ref={profileRef} className="relative">
                <button
                  ref={profileButtonRef}
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-controls="account-menu"
                  aria-label="Account menu"
                  className="flex max-w-72 items-center gap-3 rounded-full border border-white/[0.10] bg-white/[0.05] py-1.5 pl-1.5 pr-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/[0.10]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#3aa0ff] to-[#0a84ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium tracking-[-0.01em] text-white">
                      {profile?.full_name || user.email?.split("@")[0]}
                    </p>
                    <p className="text-[11px] capitalize text-white/45">
                      {profile?.role || "user"} account
                    </p>
                  </div>

                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-white/40 transition-transform duration-300 ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {profileOpen && (
                  <div
                    id="account-menu"
                    role="menu"
                    aria-label="Account"
                    className="nexus-fade-in absolute right-0 top-full mt-3 w-72 origin-top-right overflow-hidden rounded-[26px] border border-white/[0.12] bg-white/[0.07] p-2 shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl backdrop-saturate-[1.8]"
                  >
                    <div className="rounded-[18px] bg-white/[0.06] px-4 py-3">
                      <p className="truncate text-sm font-semibold tracking-[-0.01em] text-white">
                        {profile?.full_name || "Nexus Explorer"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-white/45">
                        {user.email}
                      </p>
                    </div>

                    <div className="mt-1.5">
                      {accountLinks.map(({ path, label, icon: Icon }) => (
                        <Link
                          key={path}
                          href={path}
                          onClick={closeMenus}
                          className={`flex items-center gap-3 rounded-[18px] px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                            isActive(path)
                              ? "bg-white/[0.10] text-white"
                              : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <Icon size={17} className={isActive(path) ? "text-[#64d2ff]" : "text-white/50"} />
                          {label}
                        </Link>
                      ))}
                    </div>

                    {profile?.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={closeMenus}
                        className="mt-1 flex items-center gap-3 rounded-[18px] px-4 py-2.5 text-sm font-medium text-purple-300 transition-all duration-200 hover:bg-purple-400/[0.12]"
                      >
                        <ShieldCheck size={17} />
                        Admin Control Center
                      </Link>
                    )}

                    <div className="my-1.5 h-px bg-white/[0.10]" />

                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-3 rounded-[18px] px-4 py-2.5 text-left text-sm font-medium text-[#ff453a] transition-all duration-200 hover:bg-[#ff453a]/[0.12]"
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
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          className="rounded-full border border-white/[0.10] bg-white/[0.05] p-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-200 hover:border-white/20 hover:bg-white/[0.10] lg:hidden"
        >
          {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="nexus-fade-in border-t border-white/[0.10] bg-[#0c0d11]/80 px-4 py-4 shadow-[0_28px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-[1.8] lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-0.5">
            {navigationLinks.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={closeMenus}
                aria-current={isActive(item.path) ? "page" : undefined}
                className={`rounded-[18px] px-4 py-3 text-[0.9375rem] font-medium tracking-[-0.01em] transition-all duration-200 ${
                  isActive(item.path)
                    ? "bg-white/[0.10] text-white"
                    : "text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <>
                <div className="my-2 h-px bg-white/[0.10]" />

                {[  { path: "/ai-planner", label: "AI Planner" },
                { path: "/smart-tourism", label: "Smart Tourism" },
                { path: "/safety", label: "Safety Center" },
                { path: "/community-hub", label: "Community Hub" }, ...accountLinks].map(
                  (item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={closeMenus}
                      className="rounded-[18px] px-4 py-3 text-[0.9375rem] font-medium tracking-[-0.01em] text-white/70 transition-all duration-200 hover:bg-white/[0.06]"
                    >
                      {item.label}
                    </Link>
                  ),
                )}

                {profile?.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={closeMenus}
                    className="rounded-[18px] px-4 py-3 text-[0.9375rem] font-medium text-purple-300 transition-all duration-200 hover:bg-purple-400/[0.12]"
                  >
                    Admin Panel
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-[18px] px-4 py-3 text-left text-[0.9375rem] font-medium text-[#ff453a] transition-all duration-200 hover:bg-[#ff453a]/[0.12]"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={closeMenus}
                  className="nexus-button-secondary nexus-button-block"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMenus}
                  className="nexus-button-primary nexus-button-block"
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
