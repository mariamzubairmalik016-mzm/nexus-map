import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Marcellus } from "next/font/google";

import "../index.css";
import "leaflet/dist/leaflet.css";

// All pages in this app use client-side hooks (useAuth, useGeolocation, etc.)
// so we must opt out of static prerendering at build time.
export const dynamic = "force-dynamic";


import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const marcellus = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-marcellus" });

export const metadata: Metadata = {
  title: {
    default: "Nexus Map — Intelligent worldwide navigation",
    template: "%s · Nexus Map",
  },
  description:
    "Explore the world with intelligent search, live GPS tracking, offline navigation and community-powered local knowledge.",
  applicationName: "Nexus Map",
  openGraph: {
    title: "Nexus Map",
    description: "Intelligent worldwide navigation with GPS, offline maps, AI planning and community knowledge.",
    siteName: "Nexus Map",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // `viewportFit: cover` lets the page reach into the notch/home-indicator
  // area on phones; the safe-area padding in index.css keeps content clear of
  // it. Zoom is deliberately left enabled — disabling it locks out anyone who
  // needs to magnify text.
  viewportFit: "cover",
};

import Navbar from "../components/layouts/Navbar";
import Footer from "../components/layouts/Footer";
import AIChatbot from "../components/ai/AIChatbot";
import CinematicBackground from "../components/ui/CinematicBackground";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${marcellus.variable} font-sans antialiased bg-[#020617] text-white`}>
        <Providers>
          {/* Keyboard users can jump straight to content, past the 8-item nav. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-xl focus:bg-cyan-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
          >
            Skip to main content
          </a>
          <div className="relative min-h-screen overflow-x-hidden bg-[#020617] text-white">
            <CinematicBackground />
            <Navbar />
            <main id="main" tabIndex={-1} className="relative z-10 min-h-[calc(100dvh-80px)] pt-20 focus:outline-none">
              {children}
            </main>
            <div className="relative z-10">
              <Footer />
            </div>
            <AIChatbot />
          </div>
        </Providers>
      </body>
    </html>
  );
}
