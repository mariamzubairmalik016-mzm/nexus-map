import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { signIn } from "next-auth/react";
import GoogleSignInButton from "./GoogleSignInButton";

const LoginForm = () => {
  const navigate = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Cheap client-side guard so the user gets an answer near the field
    // instead of a round-trip and a toast.
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    try {
      setSubmitting(true);
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success("Login successful.");
      navigate.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to login.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      <div className="block">
        <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-slate-300">
          Email
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
          <Mail size={19} className="text-cyan-400" aria-hidden="true" />
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(error)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>
      </div>

      <div className="block">
        <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-300">
          Password
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
          <LockKeyhole size={19} className="text-cyan-400" aria-hidden="true" />
          <input
            id="login-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors duration-200 hover:text-white"
          >
            {show ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm text-cyan-300 transition-colors duration-200 hover:text-cyan-200">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="nexus-button-primary w-full py-4 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting && <LoaderCircle className="animate-spin" size={19} aria-hidden="true" />}
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <GoogleSignInButton callbackUrl="/dashboard" />
    </form>
  );
};

export default LoginForm;
