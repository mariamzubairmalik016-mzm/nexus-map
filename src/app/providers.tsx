"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { registerOfflineWorker } from "../services/registerOfflineWorker";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerOfflineWorker();
  }, []);

  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" />
    </SessionProvider>
  );
}
