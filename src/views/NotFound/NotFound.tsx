import { Compass, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const NotFound = () => {
  const reduce = useReducedMotion();

  return (
    <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="nexus-card max-w-2xl p-10 text-center sm:p-14"
      >
        <div className="nexus-float mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 shadow-[0_0_40px_rgba(34,211,238,0.16)]">
          <Compass size={40} />
        </div>
        <p className="nexus-eyebrow mt-6">Error 404</p>
        <h1 className="text-hero-display mt-3 text-5xl sm:text-6xl">
          <span className="nexus-gradient-text">Lost the signal</span>
        </h1>
        <p className="mt-4 text-slate-400">The page you're looking for drifted off the map.</p>
        <Link  href="/" className="nexus-button-primary mx-auto mt-8 w-fit">
          <Home size={18} />
          Back to Home
        </Link>
      </motion.div>
    </section>
  );
};

export default NotFound;
