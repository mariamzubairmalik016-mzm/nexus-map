import Hero from "../../components/Hero/Hero";
import AISearch from "../../components/Home/AISearch";
import PopularDestinations from "../../components/Home/PopularDestinations";
import Stats from "../../components/Home/Stats";
import WorldPreview from "../../components/Home/WorldPreview";
import Features from "../../components/Home/Features";

const Home = () => (
  <div className="overflow-hidden">
    <Hero />
    <AISearch />
    <PopularDestinations />
    <Stats />
    <WorldPreview />
    <Features />
  </div>
);
export default Home;
