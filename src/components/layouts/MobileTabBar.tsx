"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Map, ShieldAlert, Users } from "lucide-react";

/**
 * Primary navigation on a phone.
 *
 * The only way to move around on a small screen was the hamburger: two taps
 * and a full-screen overlay to reach a sibling page, with nothing on screen to
 * say where you were. A phone expects its main destinations to be one thumb
 * away, which is what a tab bar is for.
 *
 * Five entries, deliberately — that is the limit past which targets get too
 * narrow to hit reliably. Everything else (profile, settings, offline maps,
 * the AI planner) stays in the hamburger, which is the right home for
 * secondary navigation.
 */
const TABS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/map", label: "Map", icon: Map },
  { path: "/safety", label: "Safety", icon: ShieldAlert },
  { path: "/community-hub", label: "Community", icon: Users },
];

const MobileTabBar = () => {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[95] border-t border-white/[0.12] bg-white/[0.06] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-3xl backdrop-saturate-[2.2] lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <li key={path} className="flex-1">
              <Link
                href={path}
                aria-current={active ? "page" : undefined}
                // 56px clears the 44pt minimum with room for the label.
                className={`flex h-14 flex-col items-center justify-center gap-1 transition-colors duration-200 ${
                  active ? "text-[#64d2ff]" : "text-white/55 active:text-white"
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileTabBar;
