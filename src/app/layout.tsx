import type { Metadata } from "next";
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
  title: "Nexus Map",
  description: "Next-generation maps and routing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${marcellus.variable} font-sans antialiased text-gray-900 bg-white dark:text-gray-100 dark:bg-black`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
