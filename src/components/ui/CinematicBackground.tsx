"use client";
import { useEffect, useRef } from "react";

/**
 * Premium global animated background: multi-layered aurora, map grid,
 * decorative SVG route paths, glowing location pulses, cursor spotlight,
 * vignette, and subtle grain texture. Purely decorative (pointer-events: none).
 */
const CinematicBackground = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const noHover = window.matchMedia("(hover: none)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noHover || reduce) return;

    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${event.clientX}px`);
        el.style.setProperty("--my", `${event.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="nexus-bg" aria-hidden>
      {/* Grain texture overlay */}
      <div className="nexus-grain" />

      {/* Aurora layers */}
      <div className="nexus-bg-aurora" />

      {/* Grid overlay */}
      <div className="nexus-bg-grid" />

      {/* Decorative SVG paths */}
      <svg className="nexus-bg-lines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="nexusRouteGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#64d2ff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#64d2ff" />
            <stop offset="1" stopColor="#0a84ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nexusRouteGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bf5af2" stopOpacity="0" />
            <stop offset="0.5" stopColor="#bf5af2" />
            <stop offset="1" stopColor="#30d158" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="nexusGlowGrad">
            <stop offset="0" stopColor="#64d2ff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#64d2ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Faint geographic contours */}
        <g stroke="rgba(148,163,184,0.04)" strokeWidth="1" fill="none">
          <path d="M0 300 Q 720 250 1440 300" />
          <path d="M0 520 Q 720 590 1440 520" />
          <ellipse cx="720" cy="450" rx="640" ry="250" />
          <ellipse cx="720" cy="450" rx="360" ry="150" />
          <ellipse cx="720" cy="450" rx="180" ry="80" />
        </g>

        {/* Flowing route paths */}
        <path className="nexus-route" d="M-50 700 C 300 500, 600 760, 900 500 S 1300 400, 1500 560" />
        <path className="nexus-route" style={{ animationDelay: "-3s", animationDuration: "12s" }} d="M-50 250 C 350 400, 700 200, 1050 380 S 1350 300, 1500 250" />
        <path className="nexus-route" style={{ animationDelay: "-6s", strokeDasharray: "8 500", strokeWidth: 1 }} d="M200 900 C 400 600, 800 800, 1100 400 S 1300 200, 1500 350" />

        {/* Second route with purple gradient */}
        <path
          className="nexus-route"
          style={{ animationDelay: "-2s", stroke: "url(#nexusRouteGrad2)", strokeDasharray: "6 400" }}
          d="M100 100 C 400 300, 600 100, 900 400 S 1200 600, 1400 300"
        />

        {/* Glowing location points */}
        <g fill="#30d158">
          <circle className="nexus-dot" cx="300" cy="560" r="3.5" />
          <circle className="nexus-dot" cx="900" cy="500" r="3.5" style={{ animationDelay: "-1.6s" }} />
          <circle className="nexus-dot" cx="720" cy="380" r="2.5" style={{ animationDelay: "-3.2s" }} />
        </g>
        <g fill="#64d2ff">
          <circle className="nexus-dot" cx="1050" cy="380" r="3.5" style={{ animationDelay: "-2.4s" }} />
          <circle className="nexus-dot" cx="620" cy="300" r="3" style={{ animationDelay: "-0.8s" }} />
        </g>
        <g fill="#bf5af2">
          <circle className="nexus-dot" cx="480" cy="420" r="2.5" style={{ animationDelay: "-4s" }} />
          <circle className="nexus-dot" cx="1180" cy="520" r="2.5" style={{ animationDelay: "-1.2s" }} />
        </g>

        {/* Decorative concentric rings */}
        <circle cx="300" cy="460" r="40" fill="none" stroke="rgba(48, 209, 88, 0.04)" strokeWidth="1" />
        <circle cx="300" cy="460" r="60" fill="none" stroke="rgba(48, 209, 88, 0.03)" strokeWidth="0.5" />
        <circle cx="1050" cy="280" r="35" fill="none" stroke="rgba(100, 210, 255, 0.04)" strokeWidth="1" />
        <circle cx="1050" cy="280" r="55" fill="none" stroke="rgba(100, 210, 255, 0.025)" strokeWidth="0.5" />
      </svg>

      {/* Spotlight (cursor follow) */}
      <div className="nexus-bg-spotlight" />

      {/* Cinematic vignette */}
      <div className="nexus-bg-vignette" />
    </div>
  );
};

export default CinematicBackground;
