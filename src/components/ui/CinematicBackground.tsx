import { useEffect, useRef } from "react";

/**
 * Reusable global animated background: aurora light clouds, a masked map grid,
 * faint lat/long curves, flowing route paths, glowing location pulses, a
 * cursor-follow spotlight (desktop only) and a cinematic vignette. Purely
 * decorative (pointer-events: none) and reduced-motion friendly.
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
      <div className="nexus-bg-aurora" />
      <div className="nexus-bg-grid" />

      <svg className="nexus-bg-lines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="nexusRouteGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="0.5" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* faint geographic contours / lat-long */}
        <g stroke="rgba(148,163,184,0.05)" strokeWidth="1" fill="none">
          <path d="M0 300 Q 720 250 1440 300" />
          <path d="M0 520 Q 720 590 1440 520" />
          <ellipse cx="720" cy="450" rx="640" ry="250" />
          <ellipse cx="720" cy="450" rx="360" ry="150" />
        </g>

        {/* flowing route paths */}
        <path className="nexus-route" d="M-50 700 C 300 500, 600 760, 900 500 S 1300 400, 1500 560" />
        <path className="nexus-route" style={{ animationDelay: "-3s" }} d="M-50 250 C 350 400, 700 200, 1050 380 S 1350 300, 1500 250" />

        {/* glowing location points */}
        <g fill="#34d399">
          <circle className="nexus-dot" cx="300" cy="560" r="3" />
          <circle className="nexus-dot" cx="900" cy="500" r="3" style={{ animationDelay: "-1.6s" }} />
        </g>
        <g fill="#22d3ee">
          <circle className="nexus-dot" cx="1050" cy="380" r="3" style={{ animationDelay: "-2.4s" }} />
          <circle className="nexus-dot" cx="620" cy="300" r="2.6" style={{ animationDelay: "-0.8s" }} />
        </g>
      </svg>

      <div className="nexus-bg-spotlight" />
      <div className="nexus-bg-vignette" />
    </div>
  );
};

export default CinematicBackground;
