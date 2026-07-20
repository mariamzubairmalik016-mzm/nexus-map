import HeroBackground from "./HeroBackground";
import HeroContent from "./HeroContent";
import HeroGlobe from "./HeroGlobe";

const Hero = () => (
  <section className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#020617]">
    <HeroBackground />
    <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.9fr)] lg:px-8">
      <HeroContent />
      <div className="flex justify-center lg:justify-end"><HeroGlobe /></div>
    </div>
  </section>
);
export default Hero;
