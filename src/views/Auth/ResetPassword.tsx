"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import AuthShell from "../../components/auth/AuthShell";

/**
 * Set a new password from a reset link.
 *
 * The previous version validated the length client-side and then showed
 * "Password updated (demo mode)" — the password was never changed. It also
 * ignored the token entirely, so the page worked even with no link at all.
 */
const ResetPassword = () => {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkMissing = !token || !email;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not reset the password.");
      }

      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not reset the password.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Secure access"
      title="Create new password"
      subtitle="Choose a strong password of at least 8 characters."
      footer={
        <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Back to sign in
        </Link>
      }
    >
      {/* Without a token there is nothing to authorise the change, so the form
          is not offered at all rather than failing on submit. */}
      {linkMissing ? (
        <div className="rounded-[var(--r-md)] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-semibold">This page needs a reset link.</p>
          <p className="mt-1 opacity-85">
            Open the link from your reset email, or{" "}
            <Link href="/forgot-password" className="underline">
              request a new one
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-[var(--r-md)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">New password</span>
            <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-white/10 bg-slate-950/60 px-4 transition-all focus-within:border-cyan-400/30">
              <LockKeyhole className="shrink-0 text-cyan-400" size={19} aria-hidden="true" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={Boolean(error)}
                className="min-w-0 flex-1 bg-transparent py-4 outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-slate-400 transition-colors hover:text-white"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button disabled={saving} className="nexus-button-primary nexus-button-block mt-5">
            {saving && <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />}
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
