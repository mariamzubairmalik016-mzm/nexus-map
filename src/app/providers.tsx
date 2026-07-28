"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { registerOfflineWorker } from "../services/registerOfflineWorker";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerOfflineWorker();
  }, []);

  return (
    <SessionProvider>
      {/* reducedMotion="user" makes every Framer Motion animation honour the
          OS "reduce motion" setting — the CSS media query alone can't reach
          JS-driven transforms. */}
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="top-right" toastOptions={{ ariaProps: { role: "status", "aria-live": "polite" } }} />
      </MotionConfig>
    </SessionProvider>
  );
}
