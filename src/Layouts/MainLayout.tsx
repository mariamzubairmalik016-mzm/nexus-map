import { Outlet, useLocation } from "react-router-dom";
import { Suspense, useEffect } from "react";
import { LoaderCircle } from "lucide-react";

import Navbar from "../components/layouts/Navbar";
import Footer from "../components/layouts/Footer";
import AIChatbot from "../components/ai/AIChatbot";
import PageTransition from "../components/ui/PageTransition";
import CinematicBackground from "../components/ui/CinematicBackground";

const MainLayout = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020617] text-white">
      <CinematicBackground />

      <Navbar />

      <main className="relative z-10 min-h-[calc(100vh-80px)] pt-20">
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center">
              <LoaderCircle size={40} className="animate-spin text-cyan-400" />
            </div>
          }
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>

      <div className="relative z-10">
        <Footer />
      </div>

      <AIChatbot />
    </div>
  );
};

export default MainLayout;
