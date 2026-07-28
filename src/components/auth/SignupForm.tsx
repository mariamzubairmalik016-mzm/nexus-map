"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";

import GoogleSignInButton from "./GoogleSignInButton";

/**
 * Registration form.
 *
 * Previously it sent whatever was typed — no `required`, no length rule, no
 * email check — and the server accepted it, so "notanemail" with the password
 * "1" created a real account. It also dropped the user on /login afterwards to
 * type the same credentials again.
 */
const SignupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Client-side mirror of the server schema, for an instant answer. */
  const validate = (): string | null => {
    if (name.trim().length < 2) return "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Failed to sign up.");

      // Sign in with the credentials just created rather than sending the user
      // to /login to retype them.
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.success("Account created. Please sign in.");
        router.push("/login");
        return;
      }

      toast.success("Welcome to Nexus Map.");
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to sign up.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]";

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Full name</span>
        <div className={fieldClass}>
          <UserRound size={19} className="shrink-0 text-cyan-400" aria-hidden="true" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={Boolean(error)}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
        <div className={fieldClass}>
          <Mail size={19} className="shrink-0 text-cyan-400" aria-hidden="true" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={Boolean(error)}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
        <div className={fieldClass}>
          <LockKeyhole size={19} className="shrink-0 text-cyan-400" aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            aria-invalid={Boolean(error)}
            aria-describedby="password-hint"
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            /* 44x44 — p-2 around a 17px icon gave a ~33px target, under the
               minimum for a thumb, and this sits right next to the text field. */
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-slate-400 transition-colors hover:text-white"
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {/* Stated up front rather than only after a rejected submit. */}
        <span id="password-hint" className="mt-2 block text-xs text-slate-500">
          At least 8 characters.
        </span>
      </label>

      <button disabled={submitting} className="nexus-button-primary nexus-button-block py-4">
        {submitting && <LoaderCircle className="animate-spin" size={19} aria-hidden="true" />}
        {submitting ? "Creating..." : "Create account"}
      </button>

      <GoogleSignInButton callbackUrl="/dashboard" />
    </form>
  );
};

export default SignupForm;
