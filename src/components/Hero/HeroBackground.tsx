import { motion } from "framer-motion";

const HeroBackground = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* Gradient base */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(147,51,234,.15),transparent_40%)]" />
    
    {/* Animated blobs */}
    <motion.div
      animate={{ x: [0, 70, 0], y: [0, 40, 0] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -left-36 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[130px]"
    />
    <motion.div
      animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -right-36 bottom-0 h-[430px] w-[430px] rounded-full bg-purple-600/10 blur-[140px]"
    />
    <motion.div
      animate={{ x: [0, 30, 0], y: [0, -60, 0] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-emerald-500/8 blur-[100px]"
    />

    {/* Grid pattern */}
    <div className="absolute inset-0 opacity-[.06] [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:48px_48px]" />
    
    {/* Radial vignette */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(2,6,23,0)_50%,rgba(2,6,23,.8)_100%)]" />
  </div>
);

export default HeroBackground;
