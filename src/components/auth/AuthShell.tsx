import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Map } from "lucide-react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Consistent premium shell for the authentication flow. */
const AuthShell = ({ eyebrow, title, subtitle, children, footer }: Props) => {
  const reduce = useReducedMotion();

  return (
    <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="nexus-card w-full max-w-md p-7 sm:p-8"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="nexus-float mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 shadow-[0_0_34px_rgba(34,211,238,0.15)]">
            <Map size={26} />
          </div>
          {eyebrow && <p className="nexus-eyebrow">{eyebrow}</p>}
          <h1 className="text-hero-display mt-3 text-4xl">
            <span className="nexus-gradient-text">{title}</span>
          </h1>
          {subtitle && <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
      </motion.div>
    </section>
  );
};

export default AuthShell;
