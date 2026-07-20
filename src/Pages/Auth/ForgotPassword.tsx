import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (supabase) await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    toast.success("Reset link sent in demo mode.");
  };
  return <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[.04] p-7"><h1 className="text-3xl font-bold">Forgot password?</h1><p className="mt-3 text-slate-400">Enter your email to receive a reset link.</p><div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4"><Mail className="text-cyan-400" /><input value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent py-4 outline-none" /></div><button className="mt-5 w-full rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950">Send reset link</button></form></section>;
};
export default ForgotPassword;
