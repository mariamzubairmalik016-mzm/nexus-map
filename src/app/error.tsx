"use client";

// Route-segment error boundary. In the App Router this replaces the old
// top-level <ErrorBoundary> that wrapped the Vite <App/>: any render or data
// error inside a route lands here instead of blanking the page. Kept in the
// Nexus visual language so a failure still looks like part of the product.

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[route-error]", error);
    }
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle size={22} className="text-amber-300" aria-hidden="true" />
        </div>

        <h1 className="text-lg font-medium text-white">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          This page hit an unexpected error. The rest of Nexus Map is still working — try again, or
          head back to your dashboard.
        </p>

        {process.env.NODE_ENV === "development" && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] leading-5 text-amber-200/80">
            {error.message}
          </pre>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/90 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            <RefreshCw size={15} aria-hidden="true" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
