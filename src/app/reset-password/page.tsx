"use client";

import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";

import ResetPassword from "../../views/Auth/ResetPassword";

/**
 * This route did not exist, so every reset link pointed at a 404 — the view
 * was written but unreachable.
 *
 * `useSearchParams` (used inside ResetPassword to read the token) requires a
 * Suspense boundary in the App Router; without one the build fails on
 * prerendering.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-80px)] items-center justify-center" role="status">
          <LoaderCircle size={40} className="animate-spin text-cyan-400" />
        </div>
      }
    >
      <ResetPassword />
    </Suspense>
  );
}
