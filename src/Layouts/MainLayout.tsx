import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Navbar from "../components/layouts/Navbar";
import Footer from "../components/layouts/Footer";
import AIChatbot from "../components/ai/AIChatbot";

const MainLayout = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-24 h-96 w-96 rounded-full bg-cyan-500/[0.055] blur-[110px]" />
        <div className="absolute -right-36 top-60 h-[30rem] w-[30rem] rounded-full bg-purple-500/[0.055] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-500/[0.04] blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 min-h-[calc(100vh-80px)] pt-20">
        <Outlet />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>

      <AIChatbot />
    </div>
  );
};

export default MainLayout;
