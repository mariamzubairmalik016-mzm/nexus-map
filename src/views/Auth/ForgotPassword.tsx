"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import AuthShell from "../../components/auth/AuthShell";

/**
 * Request a password reset. Previously this only showed a "(demo mode)" toast
 * and issued no token, so the reset page had nothing to verify against.
 */
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      setSending(true);
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      setSent(true);
      // Shown only while email delivery is unconfigured, so the flow can be
      // completed end to end in development.
      if (payload?.data?.link) setDevLink(payload.data.link as string);
    } catch {
      toast.error("Could not send the reset link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-[var(--r-md)] border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            If that email has an account, a reset link is on its way. The link expires in one hour.
          </p>

          {devLink && (
            <div className="rounded-[var(--r-md)] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <p className="font-semibold">Email delivery is not configured yet.</p>
              <p className="mt-1 opacity-80">Use this link to continue:</p>
              <Link
                href={devLink.replace(/^https?:\/\/[^/]+/, "")}
                className="mt-2 block break-all underline"
              >
                {devLink}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
            <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-white/10 bg-slate-950/60 px-4 transition-all focus-within:border-cyan-400/30">
              <Mail className="shrink-0 text-cyan-400" size={19} aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="min-w-0 flex-1 bg-transparent py-4 outline-none"
              />
            </div>
          </label>

          <button disabled={sending} className="nexus-button-primary nexus-button-block mt-5">
            {sending && <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />}
            {sending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
