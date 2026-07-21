import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import HeroButtons from "./HeroButtons";
import HeroStats from "./HeroStats";

const HeroContent = () => (
  <motion.div initial={{ opacity: 0, x: -35 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8 }} className="min-w-0 lg:max-w-2xl">
    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
      <Sparkles size={17} /> Intelligent worldwide navigation
    </div>
    <h1 className="text-hero-display mt-6 text-5xl leading-[1.06] sm:text-6xl lg:text-7xl xl:text-8xl">
      Explore the <span className="nexus-gradient-text-animated">future</span> of maps
    </h1>
    <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
      Discover the world with intelligent search, live GPS tracking, offline navigation and community-powered local knowledge.
    </p>
    <HeroButtons />
    <HeroStats />
  </motion.div>
);
export default HeroContent;
