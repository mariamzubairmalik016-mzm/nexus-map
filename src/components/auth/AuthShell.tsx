import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Download, Map, ShieldCheck, Sparkles } from "lucide-react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Auth layout.
 *
 * One `max-w-md` card was used at every width, so a 1440px desktop showed a
 * narrow column floating in empty space. Below `lg` it stays a single centred
 * card — correct for a phone — and at `lg` it becomes a two-panel card: what
 * the product does on the left, the form on the right.
 *
 * The panel sits inside a bounded card rather than going full-bleed because
 * the global layout already renders a navbar and footer around this; a true
 * full-screen split would fight both.
 */

const POINTS = [
  { Icon: Compass, text: "Live GPS navigation with turn-by-turn guidance" },
  { Icon: Download, text: "Download regions and navigate with no signal" },
  { Icon: Sparkles, text: "Plan trips around real places, not templates" },
  { Icon: ShieldCheck, text: "Road alerts from the community as you travel" },
];

const AuthShell = ({ eyebrow, title, subtitle, children, footer }: Props) => {
  const reduce = useReducedMotion();

  return (
    /* 100dvh, not 100vh: on mobile browsers the address bar makes 100vh taller
       than the visible area, which pushed the submit button under the fold.
       `items-start sm:items-center` keeps a tall form scrollable from the top
       on a short screen instead of being clipped at both ends. */
    <section className="flex min-h-[calc(100dvh-80px)] items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-12 lg:px-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="nexus-card-elevated w-full max-w-md overflow-hidden lg:grid lg:max-w-5xl lg:grid-cols-[1.05fr_1fr]"
      >
        {/* ---- Brand panel: desktop only ------------------------------------
            Hidden below lg rather than stacked. On a phone this content would
            push the form itself off the first screen, and the form is the
            reason anyone opened the page. */}
        <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-gradient-to-br from-cyan-500/[0.07] via-slate-950/40 to-purple-600/[0.07] p-10 lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                <Map size={22} aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">Nexus Map</span>
            </div>

            <p className="text-hero-display mt-10 text-4xl leading-tight" style={{ textWrap: "balance" }}>
              Navigate anywhere,
              <br />
              <span className="nexus-gradient-text">online or off.</span>
            </p>
          </div>

          <ul className="relative mt-10 space-y-4">
            {POINTS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                <Icon size={17} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- Form panel --------------------------------------------------- */}
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-7 text-center lg:text-left">
            {/* The crest repeats the brand mark, so it only shows where the
                brand panel is absent. */}
            <div className="mb-5 flex justify-center lg:hidden">
              <span className="flex h-14 w-14 items-center justify-center rounded-[var(--r-lg)] border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 to-blue-600/15 text-cyan-300 shadow-[0_0_34px_rgba(34,211,238,0.15)]">
                <Map size={26} aria-hidden="true" />
              </span>
            </div>

            {eyebrow && <p className="nexus-eyebrow">{eyebrow}</p>}

            <h1
              className="text-hero-display mt-3 text-3xl sm:text-4xl"
              style={{ textWrap: "balance" }}
            >
              <span className="nexus-gradient-text">{title}</span>
            </h1>

            {subtitle && (
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400 lg:mx-0">
                {subtitle}
              </p>
            )}
          </div>

          {children}

          {footer && <div className="mt-7 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </motion.div>
    </section>
  );
};

export default AuthShell;
