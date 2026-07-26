import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { signIn } from "next-auth/react";

const LoginForm = () => {
  const navigate = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
          <Mail size={19} className="text-cyan-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
          <LockKeyhole size={19} className="text-cyan-400" />
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
          <button type="button" onClick={() => setShow(!show)} className="text-slate-400 hover:text-white">
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </label>

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm text-cyan-300 transition-colors duration-200 hover:text-cyan-200">
          Forgot password?
        </Link>
      </div>

      <button
        disabled={submitting}
        className="nexus-button-primary w-full py-4"
      >
        {submitting && <LoaderCircle className="animate-spin" size={19} />}
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
};

export default LoginForm;
