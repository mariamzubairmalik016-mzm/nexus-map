import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("Minimum 8 characters.");
    if (supabase) await supabase.auth.updateUser({ password });
    toast.success("Password updated.");
  };
  return <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[.04] p-7"><h1 className="text-3xl font-bold">Create new password</h1><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none" /><button className="mt-5 w-full rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950">Update password</button></form></section>;
};
export default ResetPassword;
