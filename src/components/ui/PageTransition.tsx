import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Smooth per-route enter animation. Keyed on the pathname so every navigation
 * replays a subtle fade-up. Honors prefers-reduced-motion (renders instantly).
 * Enter-only (no exit) to avoid react-router Outlet exit-content glitches and
 * to keep Leaflet/3D pages stable.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = usePathname();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
