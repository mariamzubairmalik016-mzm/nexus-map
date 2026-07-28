"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { LoaderCircle } from "lucide-react";

/**
 * "Continue with Google".
 *
 * Renders nothing unless Google is actually registered on the server. The
 * provider is only added when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are
 * both set, so asking NextAuth what exists keeps the button from appearing as
 * a control that cannot work — clicking a Google button that 404s is worse
 * than not offering it.
 */
const GoogleSignInButton = ({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) => {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getProviders()
      .then((providers) => {
        if (!cancelled) setAvailable(Boolean(providers?.google));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <>
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={() => {
          setBusy(true);
          void signIn("google", { callbackUrl });
        }}
        disabled={busy}
        className="nexus-button-secondary nexus-button-block"
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        ) : (
          /* Google's four-colour mark, inlined — the CSP on this app blocks
             remote images, and an <img> to a CDN would silently fail. */
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.5 44 31 44 24c0-1.2-.1-2.3-.4-3.5z"
            />
          </svg>
        )}
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
    </>
  );
};

export default GoogleSignInButton;
