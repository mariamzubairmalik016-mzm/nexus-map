import { Suspense } from "react";
import dynamic from "next/dynamic";
import HeroBackground from "./HeroBackground";
import HeroContent from "./HeroContent";

// Three.js globe is heavy and requires browser APIs — load it completely on the client side!
const HeroGlobe = dynamic(() => import("./HeroGlobeNew"), { ssr: false });

const Hero = () => (
  <section className="relative min-h-[calc(100dvh-80px)] overflow-hidden">
    <HeroBackground />
    <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-80px)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.9fr)] lg:px-8">
      <HeroContent />
      <div className="flex justify-center lg:justify-end">
        <Suspense
          fallback={<div className="h-[420px] w-full max-w-[460px] rounded-full bg-cyan-500/5 blur-3xl" />}
        >
          <HeroGlobe />
        </Suspense>
      </div>
    </div>
  </section>
);

export default Hero;
