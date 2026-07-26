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

/** Premium auth shell with glass card, decorative icon, and elegant typography. */
const AuthShell = ({ eyebrow, title, subtitle, children, footer }: Props) => {
  const reduce = useReducedMotion();

  return (
    <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="nexus-card-elevated w-full max-w-md p-8 sm:p-10"
      >
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 to-blue-600/15 text-cyan-300 shadow-[0_0_34px_rgba(34,211,238,0.15)]">
            <Map size={28} />
          </div>
          {eyebrow && <p className="nexus-eyebrow">{eyebrow}</p>}
          <h1 className="text-hero-display mt-4 text-4xl">
            <span className="nexus-gradient-text">{title}</span>
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">{subtitle}</p>
          )}
        </div>

        {children}

        {footer && (
          <div className="mt-8 text-center text-sm text-slate-400">{footer}</div>
        )}
      </motion.div>
    </section>
  );
};

export default AuthShell;
