import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import AuthShell from "../../components/auth/AuthShell";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (supabase) {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Reset link sent to your email.");
    } else {
      toast.success("Reset link sent (demo mode).");
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
          <Mail className="text-cyan-400" size={19} />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>
        <button className="nexus-button-primary mt-5 w-full">Send reset link</button>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
