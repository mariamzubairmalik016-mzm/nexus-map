"use client";

// Last line of defence. global-error.tsx catches failures in the root layout
// itself — the one place a normal error.tsx cannot reach — so even a broken
// shell renders a usable page instead of a white screen. It must supply its
// own <html>/<body> because it replaces the root layout when it fires.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#020617", color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
        <div
          role="alert"
          style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
        >
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Nexus Map ran into a problem</h1>
            <p style={{ marginTop: "0.5rem", color: "#94a3b8", lineHeight: 1.6, fontSize: "0.9rem" }}>
              The application failed to load. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1.25rem",
                borderRadius: "0.75rem",
                background: "#06b6d4",
                color: "#020617",
                border: "none",
                padding: "0.6rem 1.1rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
